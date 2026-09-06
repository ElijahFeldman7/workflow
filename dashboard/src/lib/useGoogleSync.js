import { useCallback, useEffect, useState } from "react";
import { ref, onValue, get, update, remove } from "firebase/database";
import { database } from "../firebase";
import { todayKey, addDaysKey, fromDateKey } from "../constants/work";
import {
  GoogleAuthRequired,
  GoogleScopeDenied,
  clearToken,
  connect,
  eventToCache,
  hasToken,
  listCalendars,
  listEvents,
} from "./googleCalendar";
import { replaceGoogleEvents, clearGoogleEvents } from "./googleEvents";

// Reads a Google calendar into its own cache and does nothing else.
//
// This file must never reference the work list. What went wrong before came
// from the sync being allowed to create, rewrite and delete rows the user
// owned, on the strength of what Google reported. It now writes one node it
// fully owns, and replaces that node outright each time.

const PULL_BEHIND_DAYS = 90;
const PULL_AHEAD_DAYS = 120;
const AUTO_SYNC_MS = 5 * 60 * 1000;

// One pull per account at a time, across every component mounting the hook.
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

const configPath = (uid) => `users/${uid}/googleCalendar`;

const emptyConfig = {
  calendarId: "",
  calendarName: "",
  lastSyncedAt: 0,
  autoSync: true,
};

export function useGoogleSync(user) {
  const [config, setConfig] = useState(emptyConfig);
  const [calendars, setCalendars] = useState([]);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [needsAuth, setNeedsAuth] = useState(!hasToken());

  useEffect(() => {
    if (!user) return undefined;
    return onValue(ref(database, configPath(user.uid)), (snapshot) => {
      const data = snapshot.val() || {};
      setConfig({
        calendarId: typeof data.calendarId === "string" ? data.calendarId : "",
        calendarName:
          typeof data.calendarName === "string" ? data.calendarName : "",
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
    if (err instanceof GoogleScopeDenied || err instanceof GoogleAuthRequired) {
      setNeedsAuth(true);
      setStatus("error");
      setMessage(
        err instanceof GoogleScopeDenied
          ? err.message
          : "Google access expired. Connect again to keep reading your calendar."
      );
      return;
    }
    setStatus("error");
    setMessage(err?.message || "Could not read the calendar");
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
    if (!user) return;
    await clearGoogleEvents(user.uid);
    await remove(ref(database, configPath(user.uid)));
  }, [user]);

  const chooseCalendar = useCallback(
    async (calendarId) => {
      const found = calendars.find((entry) => entry.id === calendarId);
      // The cache holds the old calendar's events until the next pull.
      if (user) await clearGoogleEvents(user.uid);
      await saveConfig({
        calendarId,
        calendarName: found ? found.name : calendarId,
      });
    },
    [calendars, saveConfig, user]
  );

  const syncNow = useCallback(async () => {
    if (!user || inFlight.has(user.uid)) return;
    inFlight.add(user.uid);

    try {
      const snapshot = await get(ref(database, configPath(user.uid)));
      const calendarId = (snapshot.val() || {}).calendarId;
      if (!calendarId) return;

      setStatus("syncing");
      setMessage("");

      // Always the whole window. With no sync token there is no incremental
      // state to go stale, and replacing the cache outright means a deletion
      // in Google needs no handling at all -- it simply is not in the next
      // write. Repeating series cost nothing for the same reason.
      const timeMin = fromDateKey(
        addDaysKey(todayKey(), -PULL_BEHIND_DAYS)
      ).toISOString();
      const timeMax = fromDateKey(
        addDaysKey(todayKey(), PULL_AHEAD_DAYS)
      ).toISOString();

      const { events } = await listEvents(calendarId, { timeMin, timeMax });

      const entries = [];
      events.forEach((event) => {
        const value = eventToCache(event);
        if (value) entries.push({ id: event.id, value });
      });

      await replaceGoogleEvents(user.uid, entries);
      await saveConfig({ lastSyncedAt: Date.now() });

      setStatus("idle");
      setNeedsAuth(false);
      setMessage(
        entries.length === 0
          ? "No events in this window."
          : `Showing ${entries.length} event${entries.length === 1 ? "" : "s"}.`
      );
    } catch (err) {
      fail(err);
    } finally {
      inFlight.delete(user.uid);
    }
  }, [user, fail, saveConfig]);

  useEffect(() => {
    if (!user || !config.calendarId || !config.autoSync || needsAuth)
      return undefined;
    syncNow();
    const timer = setInterval(syncNow, AUTO_SYNC_MS);
    return () => clearInterval(timer);
  }, [user, config.calendarId, config.autoSync, needsAuth, syncNow]);

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
    setAutoSync: (on) => saveConfig({ autoSync: !!on }),
  };
}
