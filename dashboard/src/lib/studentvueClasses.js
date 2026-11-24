import { push, ref, runTransaction } from "firebase/database";
import { database } from "../firebase";
import { DEFAULT_SPACE_KIND, PALETTE_KEYS } from "../constants/work";

const nameKey = (name) => name.normalize("NFKC").toLowerCase()
  .replace(/&/g, " and ").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export function schoolYearFor(date = new Date()) {
  return date.getFullYear() - (date.getMonth() < 7 ? 1 : 0);
}

export function mergeStudentVueClasses(current, names, schoolYear, idFor, now) {
  const spaces = current || {};
  const next = { ...spaces };
  const existing = new Set();
  const usedColors = new Set();
  let order = 0;
  let changed = false;

  for (const [id, space] of Object.entries(spaces)) {
    if (!space || typeof space !== "object") continue;
    if (Number.isFinite(space.order)) order = Math.max(order, space.order + 1);
    if (space.kind && space.kind !== DEFAULT_SPACE_KIND) {
      if (!space.archived) usedColors.add(space.color);
      continue;
    }
    const imported = space.studentVue;
    if (imported?.schoolYear > schoolYear) return undefined;
    if (imported?.schoolYear < schoolYear) {
      if (!space.archived) {
        next[id] = { ...space, archived: true };
        changed = true;
      }
      continue;
    }
    if (!space.archived) usedColors.add(space.color);
    if (imported?.schoolYear === schoolYear && imported.course) existing.add(imported.course);
    if (typeof space.name === "string") existing.add(nameKey(space.name));
  }

  for (const name of names) {
    const course = nameKey(name);
    if (!course || existing.has(course)) continue;
    const color = PALETTE_KEYS.find((candidate) => !usedColors.has(candidate))
      || PALETTE_KEYS[order % PALETTE_KEYS.length];
    next[idFor(course)] = {
      name,
      kind: DEFAULT_SPACE_KIND,
      color,
      teacher: "",
      room: "",
      archived: false,
      order: order++,
      createdAt: now,
      studentVue: { course, schoolYear },
    };
    usedColors.add(color);
    existing.add(course);
    changed = true;
  }
  return changed ? next : undefined;
}

export async function syncStudentVueClasses(uid, names, schoolYear) {
  const location = ref(database, `users/${uid}/spaces`);
  const ids = new Map();
  const idFor = (course) => {
    if (!ids.has(course)) ids.set(course, push(location).key);
    return ids.get(course);
  };
  const now = Date.now();
  return runTransaction(location, (current) =>
    mergeStudentVueClasses(current, names, schoolYear, idFor, now),
  { applyLocally: false });
}
