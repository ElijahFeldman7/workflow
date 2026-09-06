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

test("every source is offered", () => {
  expect(SOURCES.map((s) => s.id)).toEqual(["work", "task", "google"]);
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

describe("google events ride alongside without becoming work", () => {
  const googleEvents = [
    {
      id: "gcal:e1",
      title: "Private Lesson",
      when: { mode: "event", date: "2026-09-09", time: "17:00", endTime: "" },
    },
  ];

  test("they are tagged as google, never as work", () => {
    const merged = mergeAgenda(items, tasks, undefined, googleEvents);

    expect(merged.filter((e) => e.source === "google")).toHaveLength(1);
    // The tag is what keeps them out of anything that edits.
    expect(merged.find((e) => e.title === "Private Lesson").source).toBe("google");
  });

  test("hiding the calendar leaves your own rows alone", () => {
    const merged = mergeAgenda(items, tasks, ["work", "task"], googleEvents);

    expect(merged.some((e) => e.source === "google")).toBe(false);
    expect(merged).toHaveLength(items.length + tasks.length);
  });

  test("showing only the calendar hides work and tasks", () => {
    const merged = mergeAgenda(items, tasks, ["google"], googleEvents);

    expect(merged).toHaveLength(1);
    expect(merged[0].source).toBe("google");
  });

  test("no calendar events is simply nothing extra", () => {
    expect(mergeAgenda(items, tasks, undefined)).toHaveLength(
      items.length + tasks.length
    );
  });
});
