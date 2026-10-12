import {
  backlogGroups,
  carryOver,
  dayBlocks,
  dayEntries,
  minutesAtOffset,
  normalizeRepeat,
  repeatTaskId,
  repeatsDue,
  snapMinutes,
  timeOfMinutes,
} from "./planner";
import { layoutBlocks, layoutTimed, minutesOf } from "./calendar";
import { addDaysKey, normalizeItem, todayKey } from "../constants/work";
import { normalizeTask } from "../constants/task";
import { mergeAgenda } from "./useAgenda";

const today = todayKey();
const tomorrow = addDaysKey(today, 1);
const yesterday = addDaysKey(today, -1);

const work = (id, raw) => normalizeItem(id, { title: id, ...raw });
const task = (id, raw) => normalizeTask(id, { title: id, ...raw });
const google = (id, time, endTime) => ({
  id: `gcal:${id}`,
  title: id,
  when: { mode: "event", date: today, time, endTime },
  plan: undefined,
});

const entries = mergeAgenda(
  [
    work("essay", { when: { mode: "due", date: addDaysKey(today, 4) }, plan: { date: today, time: "16:00", minutes: 45 } }),
    work("lab", { when: { mode: "due", date: tomorrow } }),
    work("late", { when: { mode: "due", date: yesterday } }),
    work("fair", { when: { mode: "event", date: today, time: "12:00", endTime: "13:00" } }),
  ],
  [
    task("laundry", { plan: { date: today }, createdAt: 2 }),
    task("sheets", { plan: { date: today }, createdAt: 1 }),
    task("someday", {}),
    task("missed", { plan: { date: yesterday } }),
    task("missed-done", { plan: { date: yesterday }, done: true }),
    task("rep_r1_x", { plan: { date: yesterday }, repeatId: "r1" }),
  ],
  undefined,
  [google("assembly", "10:00", "11:00"), google("holiday", "", "")]
);

const ids = (list) => list.map((entry) => entry.id);

describe("clock arithmetic", () => {
  test("minutes and times turn into each other", () => {
    expect(timeOfMinutes(0)).toBe("00:00");
    expect(timeOfMinutes(615)).toBe("10:15");
    expect(minutesOf(timeOfMinutes(1005))).toBe(1005);
  });

  test("a time never leaves the day", () => {
    expect(timeOfMinutes(-30)).toBe("00:00");
    expect(timeOfMinutes(5000)).toBe("23:59");
  });

  test("times snap to the quarter hour", () => {
    expect(snapMinutes(607)).toBe(600);
    expect(snapMinutes(608)).toBe(615);
  });

  test("a point on the grid is a time, held inside the day", () => {
    // 7 AM at the top, 0.9px to the minute.
    expect(minutesAtOffset(0, 420, 0.9)).toBe(420);
    expect(minutesAtOffset(162, 420, 0.9)).toBe(600);
    expect(minutesAtOffset(-99999, 420, 0.9)).toBe(0);
    expect(minutesAtOffset(99999, 420, 0.9)).toBe(24 * 60 - 15);
  });
});

describe("a plan on an item", () => {
  test("is empty until one is made", () => {
    expect(work("a", {}).plan).toEqual({ date: "", time: "", minutes: 0 });
    expect(task("a", {}).plan).toEqual({ date: "", time: "", minutes: 0 });
  });

  test("throws away what it cannot use", () => {
    expect(
      work("a", { plan: { date: "soon", time: "25:00", minutes: -5 } }).plan
    ).toEqual({ date: "", time: "", minutes: 0 });
  });

  test("leaves the due date alone", () => {
    const item = work("a", {
      when: { mode: "due", date: tomorrow },
      plan: { date: today },
    });
    expect(item.when.date).toBe(tomorrow);
    expect(item.plan.date).toBe(today);
  });
});

describe("splitting a day", () => {
  const day = dayEntries(entries, today);

  test("fixed things are events on that day, Google's and your own", () => {
    expect(ids(day.fixed)).toEqual(["gcal:holiday", "gcal:assembly", "fair"]);
  });

  test("planned things with a time go on the clock", () => {
    expect(ids(day.timed)).toEqual(["essay"]);
  });

  test("planned things without one wait in the list, oldest first", () => {
    expect(ids(day.tray)).toEqual(["task:sheets", "task:laundry"]);
  });

  test("being due on a day is not the same as being planned for it", () => {
    expect(ids(dayEntries(entries, tomorrow).tray)).toEqual([]);
  });

  test("blocks cover fixed and planned alike, by their own lengths", () => {
    const blocks = dayBlocks(day.fixed, day.timed).map((block) => [
      block.item.id,
      block.start,
      block.end,
      block.fixed,
    ]);
    expect(blocks).toEqual([
      ["gcal:assembly", 600, 660, true],
      ["fair", 720, 780, true],
      ["essay", 960, 1005, false],
    ]);
  });

  test("a planned block with no length gets half an hour", () => {
    const [block] = dayBlocks(
      [],
      [work("a", { plan: { date: today, time: "09:00" } })]
    );
    expect(block.end - block.start).toBe(30);
  });
});

describe("what is left to plan", () => {
  const groups = backlogGroups(entries, today);
  const group = (id) => ids((groups.find((entry) => entry.id === id) || { items: [] }).items);

  test("is grouped by when it is due", () => {
    expect(groups.map((entry) => entry.label)).toEqual([
      "Overdue",
      "Due tomorrow",
      "Someday",
    ]);
    expect(group("overdue")).toEqual(["late"]);
    expect(group("tomorrow")).toEqual(["lab"]);
  });

  test("leaves out what is on the day, done, fixed, or a repeat's", () => {
    expect(group("someday")).toEqual(["task:someday", "task:missed"]);
  });

  test("leaves out everything planned in a week being looked at", () => {
    const shown = backlogGroups(entries, [yesterday, today, tomorrow]).flatMap(
      (entry) => ids(entry.items)
    );
    expect(shown).not.toContain("task:missed");
    expect(shown).not.toContain("essay");
    expect(shown).toContain("lab");
  });

  test("still offers what is planned for another day", () => {
    expect(
      backlogGroups(entries, tomorrow).flatMap((entry) => ids(entry.items))
    ).toContain("essay");
  });
});

describe("carrying over", () => {
  test("offers what was planned for a past day and not done", () => {
    expect(ids(carryOver(entries, today))).toEqual(["task:missed"]);
  });

  test("offers nothing on the day itself", () => {
    expect(carryOver(entries, yesterday)).toEqual([]);
  });

  test("believes a tick that has not been saved yet", () => {
    expect(carryOver(entries, today, () => true)).toEqual([]);
  });
});

describe("repeats", () => {
  // 2026-09-13 is a Sunday.
  const sundays = normalizeRepeat("r1", { title: "sheets", weekdays: [0] });

  test("fall on their weekdays", () => {
    expect(repeatsDue([sundays], "2026-09-13")).toHaveLength(1);
    expect(repeatsDue([sundays], "2026-09-14")).toHaveLength(0);
  });

  test("do not reach back before they began", () => {
    const late = normalizeRepeat("r2", { weekdays: [0], from: "2026-09-14" });
    expect(repeatsDue([late], "2026-09-13")).toHaveLength(0);
    expect(repeatsDue([late], "2026-09-20")).toHaveLength(1);
  });

  test("make the same key for the same day wherever they are made", () => {
    expect(repeatTaskId("r1", "2026-09-13")).toBe("rep_r1_2026-09-13");
  });

  test("ignore weekdays that are not weekdays", () => {
    expect(
      normalizeRepeat("r", { weekdays: [6, 0, 0, 9, "x", 2] }).weekdays
    ).toEqual([0, 2, 6]);
  });
});

describe("laying blocks side by side", () => {
  test("overlapping blocks share the width", () => {
    const laid = layoutBlocks([
      { item: { id: "a" }, start: 600, end: 660 },
      { item: { id: "b" }, start: 630, end: 690 },
      { item: { id: "c" }, start: 700, end: 730 },
    ]);
    expect(laid.map((block) => [block.item.id, block.column, block.columns])).toEqual([
      ["a", 0, 2],
      ["b", 1, 2],
      ["c", 0, 1],
    ]);
  });

  test("the calendar's own layout is unchanged", () => {
    const [block] = layoutTimed([
      { id: "e", when: { mode: "event", time: "09:00", endTime: "" } },
    ]);
    expect(block).toMatchObject({ start: 540, end: 600, column: 0, columns: 1 });
  });
});
