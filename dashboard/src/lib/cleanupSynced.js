import { ref, get, update } from "firebase/database";
import { database } from "../firebase";
import { normalizeItem } from "../constants/work";

// One-time repair for work items the calendar sync created before it had a
// window cap or an origin stamp. An unbounded singleEvents query expands every
// repeating series, so a daily event became ~700 rows a year and yearly
// birthdays ran to 2056.
//
// Nothing here touches Google. Items and their links are removed together, in
// a single write, so the sync never sees a link whose item has vanished --
// which is the state that used to make it delete the event remotely.

const workPath = (uid) => `users/${uid}/work`;
const linksPath = (uid) => `users/${uid}/googleCalendar/links`;

/**
 * What a row looks like decides whether it was yours or the calendar's, since
 * rows created before the origin stamp carry no marker.
 *
 *   - a class means you filed it              -> assignment, keep
 *   - a type but no class means it came back  -> copy of an assignment
 *     from Google carrying its stamped type      you already have
 *   - neither means it was never yours        -> calendar noise
 */
export function classify(items) {
  const keep = [];
  const noise = [];
  const copies = [];

  // Titles that still have a properly filed version, so a class-less twin is a
  // duplicate rather than the only record of something.
  const filedTitles = new Set(
    items
      .filter((item) => item.spaceId)
      .map((item) => item.title.trim().toLowerCase())
  );

  items.forEach((item) => {
    if (item.origin === "google") {
      noise.push(item);
      return;
    }
    if (item.spaceId) {
      keep.push(item);
      return;
    }
    if (!item.type) {
      noise.push(item);
      return;
    }
    if (filedTitles.has(item.title.trim().toLowerCase())) {
      copies.push(item);
      return;
    }
    keep.push(item);
  });

  return { keep, noise, copies };
}

async function readItems(uid) {
  const snapshot = await get(ref(database, workPath(uid)));
  const data = snapshot.val();
  return data
    ? Object.entries(data).map(([key, value]) => normalizeItem(key, value))
    : [];
}

/** Counts only, so the damage can be read before anything is written. */
export async function previewCleanup(user) {
  if (!user) return { keep: 0, noise: 0, copies: 0, total: 0 };
  const items = await readItems(user.uid);
  const { keep, noise, copies } = classify(items);
  return {
    keep: keep.length,
    noise: noise.length,
    copies: copies.length,
    total: items.length,
  };
}

/**
 * Removes the calendar noise and the duplicate copies. Assignments stay.
 * @returns {Promise<{removed: number, kept: number}>}
 */
export async function runCleanup(user) {
  if (!user) return { removed: 0, kept: 0 };

  const items = await readItems(user.uid);
  const { keep, noise, copies } = classify(items);
  const doomed = [...noise, ...copies];
  if (doomed.length === 0) return { removed: 0, kept: keep.length };

  // Both paths in one update: an item must never outlive its link, or the sync
  // would read the orphan and act on the calendar.
  const updates = {};
  doomed.forEach((item) => {
    updates[`${workPath(user.uid)}/${item.id}`] = null;
    updates[`${linksPath(user.uid)}/${item.id}`] = null;
  });

  await update(ref(database), updates);
  return { removed: doomed.length, kept: keep.length };
}
