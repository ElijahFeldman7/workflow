import { useEffect, useMemo, useState } from "react";
import { ref, onValue, set } from "firebase/database";
import { database } from "../firebase";

// Google's events live here, apart from the work list, and this is the only
// node the calendar sync is allowed to write.
//
// The whole node is replaced on every pull, which is what makes the hard parts
// disappear: an event deleted in Google is simply absent from the next write,
// nothing can be imported twice, and repeating series cost nothing because
// they are never rows you own. Losing this node loses nothing -- the next sync
// rebuilds it.

export const googleEventsPath = (uid) => `users/${uid}/googleEvents`;

// Firebase rejects these in a key, and Google is free to use them in an id.
const KEY_UNSAFE = /[.#$[\]/]/g;
export const safeKey = (eventId) => String(eventId).replace(KEY_UNSAFE, "_");

const isDateKey = (value) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
const isTime = (value) =>
  typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

/** Whatever is on disk, shaped so the calendar can render it beside work. */
export function normalizeCached(id, raw) {
  const data = raw || {};
  const when = data.when || {};
  if (!isDateKey(when.date)) return null;

  return {
    id: `gcal:${id}`,
    source: "google",
    title: typeof data.title === "string" ? data.title : "Untitled",
    notes: typeof data.notes === "string" ? data.notes : "",
    location: typeof data.location === "string" ? data.location : "",
    allDay: !!data.allDay,
    recurring: !!data.recurring,
    when: {
      mode: "event",
      date: when.date,
      time: isTime(when.time) ? when.time : "",
      endTime: isTime(when.endTime) ? when.endTime : "",
    },
    // Filled in so the calendar can treat these and work items alike without
    // special-casing every field it reads.
    spaceId: "",
    type: "",
    priority: "medium",
    done: false,
    origin: "google",
  };
}

/**
 * Replaces the cache outright. A partial update would leave events Google no
 * longer returns sitting there forever.
 */
export function replaceGoogleEvents(uid, entries) {
  const payload = {};
  entries.forEach(({ id, value }) => {
    if (id && value) payload[safeKey(id)] = value;
  });
  return set(ref(database, googleEventsPath(uid)), payload);
}

export function clearGoogleEvents(uid) {
  return set(ref(database, googleEventsPath(uid)), null);
}

/** Live read of the cache. Read-only by construction: nothing here writes. */
export function useGoogleEvents(user) {
  const [raw, setRaw] = useState(null);

  useEffect(() => {
    if (!user) {
      setRaw(null);
      return undefined;
    }
    const unsubscribe = onValue(
      ref(database, googleEventsPath(user.uid)),
      (snapshot) => setRaw(snapshot.val()),
      () => setRaw(null) // context only; a failure here must not break the page
    );
    return () => unsubscribe && unsubscribe();
  }, [user]);

  return useMemo(() => {
    if (!raw) return [];
    return Object.entries(raw)
      .map(([id, value]) => normalizeCached(id, value))
      .filter(Boolean);
  }, [raw]);
}
