import { minutesOf, timedBlock } from "./calendar";
import {
  BUCKETS,
  bucketFor,
  fromDateKey,
  isDateKey,
  isTimeValue,
  sortByDate,
} from "../constants/work";

// Planning a day. Everything on one is either fixed (an event with a time of
// its own, which you plan around) or flexible (work and to-dos you chose to do
// that day, with a time only if you gave it one).

export const DEFAULT_PLAN_MINUTES = 30;
export const SNAP_MINUTES = 15;
export const LENGTHS = [15, 30, 45, 60, 90, 120];

const DAY_MINUTES = 24 * 60;
const pad = (value) => String(value).padStart(2, "0");

/** The inverse of minutesOf, held inside a single day. */
export function timeOfMinutes(minutes) {
  const held = Math.min(Math.max(Math.round(minutes), 0), DAY_MINUTES - 1);
  return `${pad(Math.floor(held / 60))}:${pad(held % 60)}`;
}

export function snapMinutes(minutes, step = SNAP_MINUTES) {
  return Math.round(minutes / step) * step;
}

/** Where on the clock a point y pixels down the grid falls. */
export function minutesAtOffset(y, gridTop, pxPerMinute) {
  const minutes = snapMinutes(gridTop + y / pxPerMinute);
  return Math.min(Math.max(minutes, 0), DAY_MINUTES - SNAP_MINUTES);
}

export const planMinutes = (entry) =>
  entry.plan.minutes || DEFAULT_PLAN_MINUTES;

/** Google's events and your own events: they have their own day and time. */
export const isFixed = (entry) =>
  entry.source === "google" || entry.when.mode === "event";

export const isPlannable = (entry) => !isFixed(entry);

const byPlanTime = (a, b) =>
  (a.plan.time || "99:99").localeCompare(b.plan.time || "99:99") ||
  a.createdAt - b.createdAt;

const byEventTime = (a, b) =>
  (a.when.time || "").localeCompare(b.when.time || "");

/**
 * One day, split three ways: what is fixed, what you gave a time to, and what
 * you only said you would do that day.
 */
export function dayEntries(entries, dateKey) {
  const fixed = [];
  const timed = [];
  const tray = [];

  entries.forEach((entry) => {
    if (isFixed(entry)) {
      if (entry.when.date === dateKey) fixed.push(entry);
      return;
    }
    if (entry.plan.date !== dateKey) return;
    if (isTimeValue(entry.plan.time)) timed.push(entry);
    else tray.push(entry);
  });

  fixed.sort(byEventTime);
  timed.sort(byPlanTime);
  tray.sort((a, b) => a.createdAt - b.createdAt);
  return { fixed, timed, tray };
}

/** Grid blocks for a day's timed things, fixed and planned alike. */
export function dayBlocks(fixed, timed) {
  return [
    ...fixed
      .filter((entry) => isTimeValue(entry.when.time))
      .map((entry) => ({ ...timedBlock(entry), fixed: true })),
    ...timed.map((entry) => {
      const start = minutesOf(entry.plan.time);
      return {
        item: entry,
        start,
        end: Math.min(start + planMinutes(entry), DAY_MINUTES),
        fixed: false,
      };
    }),
  ];
}

const BACKLOG_LABELS = {
  overdue: "Overdue",
  today: "Due today",
  tomorrow: "Due tomorrow",
  later: "Later",
  someday: "Someday",
};

/**
 * What could still be planned, soonest due first. Things already on the days
 * being looked at are left out, since they are on screen beside it.
 */
export function backlogGroups(entries, dateKeys, isDone = (entry) => entry.done) {
  const onScreen = new Set([].concat(dateKeys));
  const byBucket = new Map();

  entries.forEach((entry) => {
    if (!isPlannable(entry) || isDone(entry)) return;
    if (onScreen.has(entry.plan.date)) return;
    // A repeat's to-do belongs to its own day, not to a list of leftovers.
    if (entry.repeatId && entry.plan.date) return;
    const bucket = bucketFor(entry);
    const list = byBucket.get(bucket) || [];
    list.push(entry);
    byBucket.set(bucket, list);
  });

  return BUCKETS.filter((bucket) => byBucket.has(bucket.id)).map((bucket) => ({
    id: bucket.id,
    label: BACKLOG_LABELS[bucket.id] || bucket.label,
    tone: bucket.tone,
    items: byBucket.get(bucket.id).sort(sortByDate),
  }));
}

/** Planned for a day that has gone by and never done. */
export function carryOver(entries, today, isDone = (entry) => entry.done) {
  return entries
    .filter(
      (entry) =>
        isPlannable(entry) &&
        !isDone(entry) &&
        !entry.repeatId &&
        isDateKey(entry.plan.date) &&
        entry.plan.date < today
    )
    .sort((a, b) => a.plan.date.localeCompare(b.plan.date));
}

export const repeatTaskId = (repeatId, dateKey) => `rep_${repeatId}_${dateKey}`;

export const isRepeatInstance = (entry) =>
  !!entry.repeatId && String(entry.taskId || entry.id).startsWith("rep_");

/** Repeats that fall on a day: right weekday, and not before they began. */
export function repeatsDue(repeats, dateKey) {
  const weekday = fromDateKey(dateKey).getDay();
  return repeats.filter(
    (repeat) =>
      repeat.weekdays.includes(weekday) && (!repeat.from || repeat.from <= dateKey)
  );
}

export function normalizeRepeat(id, raw) {
  const data = raw || {};
  const minutes = Number(data.minutes);
  return {
    id,
    title: typeof data.title === "string" ? data.title : "Untitled",
    weekdays: Array.isArray(data.weekdays)
      ? [...new Set(data.weekdays.map(Number))]
          .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
          .sort()
      : [],
    time: isTimeValue(data.time) ? data.time : "",
    minutes: Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : 0,
    from: isDateKey(data.from) ? data.from : "",
    createdAt: Number(data.createdAt) || 0,
  };
}
