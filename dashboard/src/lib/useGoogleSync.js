import { useCallback, useEffect, useRef, useState } from "react";
import { ref, onValue, get, push, update, remove } from "firebase/database";
import { database } from "../firebase";
import { normalizeItem, todayKey, addDaysKey, fromDateKey } from "../constants/work";
import {
  GoogleAuthRequired,
  GoogleScopeDenied,
  SyncTokenExpired,
  clearToken,
  connect,
  deleteEvent,
  eventToItem,
  fingerprint,
  getEvent,
  hasToken,
  insertEvent,
  itemToEvent,
  listCalendars,
  listEvents,
  localTimeZone,
  patchEvent,
  workflowIdOf,
} from "./googleCalendar";

const PULL_WINDOW_DAYS = 90;
const AUTO_SYNC_MS = 5 * 60 * 1000;
// How many vanished links one full sync will check with Google.
const MAX_VERIFY = 60;
// A sync token only reports what changed since it was issued, so a deletion
// Google has already pruned would never reach us. Fall back to a full listing
// this often, which re-checks every link.
const FULL_SYNC_MS = 6 * 60 * 60 * 1000;

// One sync per account at a time, across every component that mounts the hook.
// The Calendar tab and the settings panel each mount their own copy, and a ref
// inside the hook only guards its own instance. Two overlapping runs both see
// an event as unlinked and both act on it, which is what produced matching
// duplicates on each side.
const inFlight = new Set();

const QUIET_POPUP_CODES = new Set([
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
]);

const POPUP_MESSAGES = {
  "auth/user-cancelled":
    "Calendar permission was declined. Connect again and allow calendar access to sync.",
  "auth/popup-blocked":
    "Your browser blocked the Google window. Allow pop-ups for this site, then try again.",
  "auth/unauthorized-domain":
    "This address is not on the Google sign-in allow list for this project yet.",
  "auth/operation-not-allowed":
    "Google sign-in is switched off for this project.",
};

// What an event and an item have to share to be considered the same thing.
const contentKey = (entry) => {
  const title = String(entry.title || "").trim().toLowerCase();
  const when = entry.when || {};
  if (!title || !when.date) return "";
  return [title, when.date, when.time || "", when.endTime || ""].join("|");
};

const configPath = (uid) => `users/${uid}/googleCalendar`;
const linksPath = (uid) => `users/${uid}/googleCalendar/links`;
const workPath = (uid) => `users/${uid}/work`;

const emptyConfig = {
  calendarId: "",
  calendarName: "",
  syncToken: "",
  lastSyncedAt: 0,
  autoSync: true,
};

export function useGoogleSync(user, items, ready) {
  const [config, setConfig] = useState(emptyConfig);
  const [calendars, setCalendars] = useState([]);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [needsAuth, setNeedsAuth] = useState(!hasToken());

  const latest = useRef({ items, ready });
  latest.current = { items, ready };

  useEffect(() => {
    if (!user) return undefined;
    return onValue(ref(database, configPath(user.uid)), (snapshot) => {
      const data = snapshot.val() || {};
      setConfig({
        calendarId: typeof data.calendarId === "string" ? data.calendarId : "",
        calendarName:
          typeof data.calendarName === "string" ? data.calendarName : "",
        syncToken: typeof data.syncToken === "string" ? data.syncToken : "",
        lastSyncedAt: Number(data.lastSyncedAt) || 0,
        autoSync: data.autoSync !== false,
      });
    });
  }, [user]);

  const saveConfig = useCallback(
    (changes) => {
      if (!user) return Promise.resolve();
      return update(ref(database, configPath(user.uid)), changes);
    },
    [user]
  );

  const fail = useCallback((err) => {
    if (err instanceof GoogleScopeDenied) {
      setNeedsAuth(true);
      setStatus("error");
      setMessage(err.message);
      return;
    }
    if (err instanceof GoogleAuthRequired) {
      setNeedsAuth(true);
      setStatus("error");
      setMessage("Google access expired. Connect again to keep syncing.");
      return;
    }
    setStatus("error");
    setMessage(err?.message || "Sync failed");
  }, []);

  const loadCalendars = useCallback(async () => {
    try {
      const list = await listCalendars();
      setCalendars(list);
      return list;
    } catch (err) {
      fail(err);
      return [];
    }
  }, [fail]);

  const connectGoogle = useCallback(async () => {
    setStatus("connecting");
    setMessage("");
    try {
      await connect();
      setNeedsAuth(false);
      const list = await listCalendars();
      setCalendars(list);
      setStatus("idle");

      if (!config.calendarId) {
        const primary = list.find((entry) => entry.primary) || list[0];
        if (primary)
          await saveConfig({
            calendarId: primary.id,
            calendarName: primary.name,
            syncToken: "",
            connectedAt: Date.now(),
          });
      }
      return true;
    } catch (err) {
      if (QUIET_POPUP_CODES.has(err?.code)) {
        setStatus("idle");
        setMessage("");
        return false;
      }
      const explained = POPUP_MESSAGES[err?.code];
      if (explained) {
        setStatus("error");
        setMessage(explained);
        return false;
      }
      if (/access_denied/i.test(err?.message || "")) {
        setStatus("error");
        setMessage(new GoogleScopeDenied().message);
        return false;
      }
      fail(err);
      return false;
    }
  }, [config.calendarId, fail, saveConfig]);

  const disconnectGoogle = useCallback(async () => {
    clearToken();
    setNeedsAuth(true);
    setCalendars([]);
    setStatus("idle");
    setMessage("");
    if (user) await remove(ref(database, configPath(user.uid)));
  }, [user]);

  const chooseCalendar = useCallback(
    async (calendarId) => {
      const found = calendars.find((entry) => entry.id === calendarId);
      await saveConfig({
        calendarId,
        calendarName: found ? found.name : calendarId,
        syncToken: "",
        // The old links name events in a calendar we no longer follow.
        links: null,
      });
    },
    [calendars, saveConfig]
  );

  // Claimed before the first await by syncNow below. Setting the flag after an
  // await gave two calls a window to both get past the check and run at once.
  const runSync = useCallback(async (activeUser, current) => {
    const configSnapshot = await get(ref(database, configPath(activeUser.uid)));
    const saved = configSnapshot.val() || {};
    const calendarId = saved.calendarId;
    if (!calendarId) return;

    setStatus("syncing");
    setMessage("");

    const user = activeUser;
    const timeZone = localTimeZone();
    // A Map keeps lookups off an object whose keys come from Google.
    const links = new Map(Object.entries(saved.links || {}));
    const working = new Map(current.map((item) => [item.id, item]));

    const linkUpdates = {};
    const itemUpdates = {};
    let created = 0;
    let updated = 0;
    let pushed = 0;
    let removed = 0;
    let deduped = 0;

    const byEventId = new Map();
    // Several items pointing at one event is the wreckage of an overlapping
    // run. Keep the oldest and drop the copies, so the event has one home.
    const itemsPerEvent = new Map();
    links.forEach((link, itemId) => {
      if (!link || !link.eventId || !working.has(itemId)) return;
      const list = itemsPerEvent.get(link.eventId) || [];
      list.push(itemId);
      itemsPerEvent.set(link.eventId, list);
    });

    const olderFirst = (a, b) =>
      (working.get(a).createdAt || 0) - (working.get(b).createdAt || 0) ||
      String(a).localeCompare(String(b));

    itemsPerEvent.forEach((itemIds, eventId) => {
      const [keep, ...copies] = itemIds.slice().sort(olderFirst);
      byEventId.set(eventId, keep);
      copies.forEach((itemId) => {
        itemUpdates[itemId] = null;
        linkUpdates[itemId] = null;
        working.delete(itemId);
        deduped += 1;
      });
    });

    // Every event we create is recorded here the moment we know its id. If the
    // run dies later, flushing this is what stops the next run inserting the
    // same events all over again.
    const flush = async () => {
      if (Object.keys(itemUpdates).length > 0)
        await update(ref(database, workPath(user.uid)), itemUpdates);
      if (Object.keys(linkUpdates).length > 0)
        await update(ref(database, linksPath(user.uid)), linkUpdates);
    };

    const windowStart = addDaysKey(todayKey(), -PULL_WINDOW_DAYS);
    // A token only reports changes, so an event Google pruned before we last
    // asked would never be mentioned again. Re-list everything periodically so
    // those deletions still get noticed.
    const staleFullSync =
      !saved.lastFullSyncAt || Date.now() - saved.lastFullSyncAt > FULL_SYNC_MS;
    let incremental = !!saved.syncToken && !staleFullSync;

    try {
      let pull;
      try {
        pull = await listEvents(calendarId, {
          syncToken: incremental ? saved.syncToken : "",
          timeMin: fromDateKey(windowStart).toISOString(),
        });
      } catch (err) {
        if (!(err instanceof SyncTokenExpired)) throw err;
        incremental = false;
        pull = await listEvents(calendarId, {
          timeMin: fromDateKey(windowStart).toISOString(),
        });
      }

      // An event carries the id of the item it came from, so a link lost to a
      // failed sync, a disconnect, or a wiped config can be picked back up.
      pull.events.forEach((event) => {
        if (byEventId.has(event.id)) return;
        const itemId = workflowIdOf(event);
        if (itemId && working.has(itemId)) byEventId.set(event.id, itemId);
      });

      // The mirror of the item dedupe above: one item stamped on several
      // events means a run inserted it more than once. Keep whichever the link
      // already names and delete the rest from Google.
      const eventsPerItem = new Map();
      pull.events.forEach((event) => {
        if (event.status === "cancelled") return;
        const itemId = workflowIdOf(event);
        if (!itemId || !working.has(itemId)) return;
        const list = eventsPerItem.get(itemId) || [];
        list.push(event.id);
        eventsPerItem.set(itemId, list);
      });

      const staleEventIds = new Set();
      eventsPerItem.forEach((eventIds, itemId) => {
        if (eventIds.length < 2) return;
        const link = links.get(itemId);
        const linked = link && link.eventId;
        const keep = eventIds.includes(linked) ? linked : eventIds[0];
        eventIds.forEach((id) => {
          if (id !== keep) staleEventIds.add(id);
        });
      });

      // Items with no link of their own, indexed by what they look like.
      const orphans = new Map();
      working.forEach((candidate, id) => {
        const link = links.get(id);
        if (link && link.eventId) return;
        const key = contentKey(candidate);
        if (key && !orphans.has(key)) orphans.set(key, id);
      });

      // A deletion in Google is a deletion here.
      const drop = (itemId) => {
        itemUpdates[itemId] = null;
        linkUpdates[itemId] = null;
        working.delete(itemId);
        removed += 1;
      };

      pull.events.forEach((event) => {
        const itemId = byEventId.get(event.id);

        if (event.status === "cancelled") {
          if (itemId && working.has(itemId)) drop(itemId);
          return;
        }

        // A surplus copy of an item we already have. It gets deleted from
        // Google below rather than pulled in as another row here.
        if (staleEventIds.has(event.id)) return;

        const mapped = eventToItem(event);
        if (!mapped) return;

        const absorb = (id) => {
          const existing = working.get(id);
          const merged = normalizeItem(id, {
            ...existing,
            ...mapped,
            spaceId: existing.spaceId,
            createdAt: existing.createdAt,
            completedAt: mapped.done ? existing.completedAt || Date.now() : 0,
          });
          if (fingerprint(merged) !== fingerprint(existing)) {
            itemUpdates[id] = {
              title: merged.title,
              notes: merged.notes,
              location: merged.location,
              when: merged.when,
              type: merged.type,
              priority: merged.priority,
              done: merged.done,
              completedAt: merged.completedAt,
            };
            updated += 1;
          }
          working.set(id, merged);
          byEventId.set(event.id, id);
          linkUpdates[id] = {
            eventId: event.id,
            fingerprint: fingerprint(merged),
            syncedAt: Date.now(),
          };
        };

        if (itemId && working.has(itemId)) {
          absorb(itemId);
          return;
        }

        if (itemId) return;

        // An event that matches an unlinked item to the letter is that item --
        // the leftover of an earlier sync, not something new. Claim it rather
        // than making a second copy. Each item can only be claimed once, so
        // genuinely repeated events still come through separately.
        const twin = orphans.get(contentKey(mapped));
        if (twin) {
          orphans.delete(contentKey(mapped));
          absorb(twin);
          return;
        }

        const newRef = push(ref(database, workPath(user.uid)));
        const record = normalizeItem(newRef.key, {
          ...mapped,
          spaceId: "",
          createdAt: Date.now(),
          completedAt: 0,
        });
        itemUpdates[newRef.key] = {
          title: record.title,
          spaceId: "",
          type: record.type,
          priority: record.priority,
          location: record.location,
          notes: record.notes,
          when: record.when,
          done: record.done,
          createdAt: record.createdAt,
          completedAt: 0,
        };
        linkUpdates[newRef.key] = {
          eventId: event.id,
          fingerprint: fingerprint(record),
          syncedAt: Date.now(),
        };
        working.set(newRef.key, record);
        byEventId.set(event.id, newRef.key);
        created += 1;
      });

      const linkFor = (itemId) =>
        Object.prototype.hasOwnProperty.call(linkUpdates, itemId)
          ? linkUpdates[itemId]
          : links.get(itemId);

      // A full sync gets no cancellation rows for events Google has already
      // pruned, so anything linked but absent from the pull gets asked about
      // directly. Only inside the window we actually pulled.
      if (!incremental) {
        const seen = new Set(pull.events.map((event) => event.id));
        const missing = [...working.values()].filter((item) => {
          const link = linkFor(item.id);
          return (
            link &&
            link.eventId &&
            !seen.has(link.eventId) &&
            item.when.date &&
            item.when.date >= windowStart
          );
        });

        for (const item of missing.slice(0, MAX_VERIFY)) {
          const remote = await getEvent(calendarId, linkFor(item.id).eventId);
          if (remote === null || remote.status === "cancelled") drop(item.id);
        }
      }

      // Whatever we have learned so far is safe on disk before we start
      // writing to Google.
      await flush();

      for (const item of working.values()) {
        if (!item.when.date) continue;
        const resource = itemToEvent(item, timeZone);
        if (!resource) continue;
        const link = linkFor(item.id);
        const stamp = fingerprint(item);

        if (!link) {
          const remote = await insertEvent(calendarId, resource);
          if (remote && remote.id) {
            linkUpdates[item.id] = {
              eventId: remote.id,
              fingerprint: stamp,
              syncedAt: Date.now(),
            };
            pushed += 1;
          }
          continue;
        }

        if (link.fingerprint !== stamp) {
          await patchEvent(calendarId, link.eventId, resource);
          linkUpdates[item.id] = {
            eventId: link.eventId,
            fingerprint: stamp,
            syncedAt: Date.now(),
          };
          pushed += 1;
        }
      }

      // Surplus copies in Google, from a run that inserted the same item twice.
      for (const eventId of staleEventIds) {
        await deleteEvent(calendarId, eventId);
        deduped += 1;
      }

      for (const [itemId, link] of links) {
        if (working.has(itemId) || !link || !link.eventId) continue;
        if (linkUpdates[itemId] === null) continue;
        await deleteEvent(calendarId, link.eventId);
        linkUpdates[itemId] = null;
      }

      await flush();

      await saveConfig({
        syncToken: pull.nextSyncToken || "",
        lastSyncedAt: Date.now(),
        ...(incremental ? {} : { lastFullSyncAt: Date.now() }),
      });

      setStatus("idle");
      setNeedsAuth(false);
      const tidied = deduped > 0 ? ` Removed ${deduped} duplicate(s).` : "";
      setMessage(
        created + updated + pushed + removed + deduped === 0
          ? "Already up to date."
          : `Pulled ${created} new, ${updated} changed and ${removed} removed; pushed ${pushed}.${tidied}`
      );
    } catch (err) {
      // Save the links for events we already created. Losing them here is what
      // makes the next sync insert a second copy of everything.
      try {
        await flush();
      } catch (writeError) {
        /* the original failure is the one worth reporting */
      }
      fail(err);
    }
  }, [fail, saveConfig]);

  // Kept separate from the work above so the in-flight claim can be taken
  // before anything awaits.
  const syncNow = useCallback(async () => {
    if (!user) return;
    const { items: current, ready: isReady } = latest.current;
    if (!isReady) return;

    if (inFlight.has(user.uid)) return;
    inFlight.add(user.uid);
    try {
      await runSync(user, current);
    } finally {
      inFlight.delete(user.uid);
    }
  }, [user, runSync]);

  // Drops the sync token so the next run re-lists the calendar in full, which
  // is what reaps duplicates and deletions Google no longer reports.
  const resync = useCallback(async () => {
    await saveConfig({ syncToken: "", lastFullSyncAt: 0 });
    await syncNow();
  }, [saveConfig, syncNow]);

  const importItems = useCallback(
    async (parsed) => {
      if (!user || parsed.length === 0) return 0;
      const updates = {};
      parsed.forEach((entry) => {
        const newRef = push(ref(database, workPath(user.uid)));
        const record = normalizeItem(newRef.key, {
          ...entry,
          spaceId: "",
          createdAt: Date.now(),
          completedAt: 0,
        });
        updates[newRef.key] = {
          title: record.title,
          spaceId: "",
          type: record.type,
          priority: record.priority,
          location: record.location,
          notes: record.notes,
          when: record.when,
          done: false,
          createdAt: record.createdAt,
          completedAt: 0,
        };
      });
      await update(ref(database, workPath(user.uid)), updates);
      return parsed.length;
    },
    [user]
  );

  useEffect(() => {
    if (!user || !config.calendarId || !config.autoSync || needsAuth) return undefined;
    if (!ready) return undefined;
    syncNow();
    const timer = setInterval(syncNow, AUTO_SYNC_MS);
    return () => clearInterval(timer);
  }, [user, config.calendarId, config.autoSync, needsAuth, ready, syncNow]);

  useEffect(() => {
    if (!config.calendarId || needsAuth || calendars.length > 0) return;
    loadCalendars();
  }, [config.calendarId, needsAuth, calendars.length, loadCalendars]);

  return {
    config,
    calendars,
    status,
    message,
    needsAuth,
    connected: !!config.calendarId,
    connectGoogle,
    disconnectGoogle,
    chooseCalendar,
    loadCalendars,
    syncNow,
    resync,
    importItems,
    setAutoSync: (on) => saveConfig({ autoSync: !!on }),
  };
}
