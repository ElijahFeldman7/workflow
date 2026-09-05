import { mergeAgenda, SOURCES } from "./useAgenda";
import { byDate } from "./calendar";

const items = [
  { id: "w1", title: "Cell lab", when: { mode: "due", date: "2026-09-11", time: "" } },
  { id: "w2", title: "Activity Fair", when: { mode: "event", date: "2026-09-12", time: "15:00" } },
];
const tasks = [
  { id: "t1", title: "Call dentist", when: { mode: "due", date: "2026-09-11", time: "09:00" } },
  { id: "t2", title: "No date task", when: { mode: "due", date: "", time: "" } },
];

test("both sources are offered", () => {
  expect(SOURCES.map((s) => s.id)).toEqual(["work", "task"]);
});

test("merging tags every entry with where it came from", () => {
  const merged = mergeAgenda(items, tasks);
  expect(merged).toHaveLength(4);
  expect(merged.filter((e) => e.source === "work")).toHaveLength(2);
  expect(merged.filter((e) => e.source === "task")).toHaveLength(2);
});

test("task ids are namespaced so they cannot collide with work ids", () => {
  const merged = mergeAgenda([{ id: "x", when: {} }], [{ id: "x", when: {} }]);
  expect(merged.map((e) => e.id)).toEqual(["x", "task:x"]);
  expect(merged[1].taskId).toBe("x");
});

test("either source can be hidden", () => {
  expect(mergeAgenda(items, tasks, ["work"]).every((e) => e.source === "work")).toBe(true);
  expect(mergeAgenda(items, tasks, ["task"]).every((e) => e.source === "task")).toBe(true);
  expect(mergeAgenda(items, tasks, [])).toEqual([]);
});

test("the merged list drops into the calendar grouping unchanged", () => {
  const grouped = byDate(mergeAgenda(items, tasks));
  expect(grouped.get("2026-09-11").map((e) => e.title)).toEqual([
    "Call dentist",
    "Cell lab",
  ]);
  expect(grouped.get("2026-09-12").map((e) => e.title)).toEqual(["Activity Fair"]);
  expect(grouped.has("")).toBe(false);
});

test("merging does not mutate either input", () => {
  const originalItems = JSON.parse(JSON.stringify(items));
  mergeAgenda(items, tasks);
  expect(items).toEqual(originalItems);
});
