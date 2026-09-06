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

  const running = useRef(false);
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

  const syncNow = useCallback(async () => {
    if (!user || running.current) return;
    const { items: current, ready: isReady } = latest.current;
    if (!isReady) return;

    const configSnapshot = await get(ref(database, configPath(user.uid)));
    const saved = configSnapshot.val() || {};
    const calendarId = saved.calendarId;
    if (!calendarId) return;

    running.current = true;
    setStatus("syncing");
    setMessage("");

    const timeZone = localTimeZone();
    const links = saved.links || {};
    const working = new Map(current.map((item) => [item.id, item]));
    const byEventId = new Map();
    Object.entries(links).forEach(([itemId, link]) => {
      if (link && link.eventId) byEventId.set(link.eventId, itemId);
    });

    const linkUpdates = {};
    const itemUpdates = {};
    let created = 0;
    let updated = 0;
    let pushed = 0;
    let removed = 0;

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
    let incremental = !!saved.syncToken;

    try {
      let pull;
      try {
        pull = await listEvents(calendarId, {
          syncToken: saved.syncToken || "",
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

      // Items with no link of their own, indexed by what they look like.
      const orphans = new Map();
      working.forEach((candidate, id) => {
        if (links[id] && links[id].eventId) return;
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
        linkUpdates[itemId] !== undefined ? linkUpdates[itemId] : links[itemId];

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

      for (const [itemId, link] of Object.entries(links)) {
        if (working.has(itemId) || !link || !link.eventId) continue;
        if (linkUpdates[itemId] === null) continue;
        await deleteEvent(calendarId, link.eventId);
        linkUpdates[itemId] = null;
      }

      await flush();

      await saveConfig({
        syncToken: pull.nextSyncToken || "",
        lastSyncedAt: Date.now(),
      });

      setStatus("idle");
      setNeedsAuth(false);
      setMessage(
        created + updated + pushed + removed === 0
          ? "Already up to date."
          : `Pulled ${created} new, ${updated} changed and ${removed} removed; pushed ${pushed}.`
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
    } finally {
      running.current = false;
    }
  }, [user, fail, saveConfig]);

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
    importItems,
    setAutoSync: (on) => saveConfig({ autoSync: !!on }),
  };
}
