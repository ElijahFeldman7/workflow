import { useEffect, useMemo, useState } from "react";
import { ref, onValue, set } from "firebase/database";
import { database } from "../firebase";
import { addDaysKey, toDateKey } from "../constants/work";

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

const pad = (value) => String(value).padStart(2, "0");
const timeOf = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

// A series that never ends is cut off by the sync window long before this.
const MAX_SPAN_DAYS = 370;

function entry(id, data, when, allDay) {
  return {
    id: `gcal:${id}`,
    source: "google",
    title: typeof data.title === "string" ? data.title : "Untitled",
    notes: typeof data.notes === "string" ? data.notes : "",
    location: typeof data.location === "string" ? data.location : "",
    allDay,
    recurring: !!data.recurring,
    when: { mode: "event", ...when },
    // Filled in so the calendar can treat these and work items alike without
    // special-casing every field it reads.
    spaceId: "",
    type: "",
    priority: "medium",
    done: false,
    origin: "google",
  };
}

// One entry per day an event touches, so a three-day trip shows on all three.
// The first keeps the plain id; later days are suffixed with their date.
function spread(id, data, firstKey, lastKey, whenFor) {
  const out = [];
  let key = firstKey;
  for (let i = 0; i < MAX_SPAN_DAYS && key <= lastKey; i += 1) {
    const when = whenFor(key);
    out.push(
      entry(key === firstKey ? id : `${id}@${key}`, data, when, !when.time)
    );
    key = addDaysKey(key, 1);
  }
  return out;
}

/**
 * Whatever is on disk, shaped so the calendar can render it beside work.
 * Times are worked out here, on read, so they follow the timezone of the
 * device looking at them rather than the one that happened to run the sync.
 */
export function expandCached(id, raw) {
  const data = raw || {};
  const start = data.start || {};
  const end = data.end || {};

  if (isDateKey(start.date)) {
    // Google's end date for an all-day event is the day after it finishes.
    const lastKey =
      isDateKey(end.date) && end.date > start.date
        ? addDaysKey(end.date, -1)
        : start.date;
    return spread(id, data, start.date, lastKey, (key) => ({
      date: key,
      time: "",
      endTime: "",
    }));
  }

  if (typeof start.dateTime === "string") {
    const from = new Date(start.dateTime);
    if (Number.isNaN(from.getTime())) return [];
    const until = end.dateTime ? new Date(end.dateTime) : null;
    const hasEnd = !!until && !Number.isNaN(until.getTime()) && until > from;

    const firstKey = toDateKey(from);
    // Ending on the stroke of midnight belongs to the day before.
    const lastKey = hasEnd ? toDateKey(new Date(until.getTime() - 1)) : firstKey;
    const endsAtMidnight = hasEnd && toDateKey(until) !== lastKey;

    return spread(id, data, firstKey, lastKey, (key) => {
      const isFirst = key === firstKey;
      const isLast = key === lastKey;
      if (!isFirst && !isLast) return { date: key, time: "", endTime: "" };
      return {
        date: key,
        time: isFirst ? timeOf(from) : "00:00",
        endTime: !hasEnd
          ? ""
          : isLast && !endsAtMidnight
          ? timeOf(until)
          : "23:59",
      };
    });
  }

  // Written before the cache kept Google's own start and end. The next pull
  // replaces it.
  const when = data.when || {};
  if (!isDateKey(when.date)) return [];
  return [
    entry(
      id,
      data,
      {
        date: when.date,
        time: isTime(when.time) ? when.time : "",
        endTime: isTime(when.endTime) ? when.endTime : "",
      },
      !!data.allDay
    ),
  ];
}

export function normalizeCached(id, raw) {
  return expandCached(id, raw)[0] || null;
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
    return Object.entries(raw).flatMap(([id, value]) =>
      expandCached(id, value)
    );
  }, [raw]);
}
