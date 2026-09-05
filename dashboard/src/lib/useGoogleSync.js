import { useCallback, useEffect, useRef, useState } from "react";
import { ref, onValue, get, push, update, remove } from "firebase/database";
import { database } from "../firebase";
import { normalizeItem, todayKey, addDaysKey, fromDateKey } from "../constants/work";
import {
  GoogleAuthRequired,
  SyncTokenExpired,
  clearToken,
  connect,
  deleteEvent,
  eventToItem,
  fingerprint,
  hasToken,
  insertEvent,
  itemToEvent,
  listCalendars,
  listEvents,
  localTimeZone,
  patchEvent,
} from "./googleCalendar";

const PULL_WINDOW_DAYS = 90;
const AUTO_SYNC_MS = 5 * 60 * 1000;

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
      if (err?.code === "auth/popup-closed-by-user") {
        setStatus("idle");
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

    try {
      let pull;
      try {
        pull = await listEvents(calendarId, {
          syncToken: saved.syncToken || "",
          timeMin: fromDateKey(
            addDaysKey(todayKey(), -PULL_WINDOW_DAYS)
          ).toISOString(),
        });
      } catch (err) {
        if (!(err instanceof SyncTokenExpired)) throw err;
        pull = await listEvents(calendarId, {
          timeMin: fromDateKey(
            addDaysKey(todayKey(), -PULL_WINDOW_DAYS)
          ).toISOString(),
        });
      }

      pull.events.forEach((event) => {
        const itemId = byEventId.get(event.id);

        if (event.status === "cancelled") {
          if (itemId) {
            itemUpdates[itemId] = null;
            linkUpdates[itemId] = null;
            working.delete(itemId);
          }
          return;
        }

        const mapped = eventToItem(event);
        if (!mapped) return;

        if (itemId && working.has(itemId)) {
          const existing = working.get(itemId);
          const merged = normalizeItem(itemId, {
            ...existing,
            ...mapped,
            spaceId: existing.spaceId,
            createdAt: existing.createdAt,
            completedAt: mapped.done ? existing.completedAt || Date.now() : 0,
          });
          if (fingerprint(merged) !== fingerprint(existing)) {
            itemUpdates[itemId] = {
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
          working.set(itemId, merged);
          linkUpdates[itemId] = {
            eventId: event.id,
            fingerprint: fingerprint(merged),
            syncedAt: Date.now(),
          };
          return;
        }

        if (itemId) return;

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

      if (Object.keys(itemUpdates).length > 0)
        await update(ref(database, workPath(user.uid)), itemUpdates);
      if (Object.keys(linkUpdates).length > 0)
        await update(ref(database, linksPath(user.uid)), linkUpdates);

      await saveConfig({
        syncToken: pull.nextSyncToken || "",
        lastSyncedAt: Date.now(),
      });

      setStatus("idle");
      setNeedsAuth(false);
      setMessage(
        created + updated + pushed === 0
          ? "Already up to date."
          : `Pulled ${created} new and ${updated} changed, pushed ${pushed}.`
      );
    } catch (err) {
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
