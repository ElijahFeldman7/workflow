import {
  layoutTimed,
  hourRange,
  weekMatrix,
  shiftWeek,
  weekLabel,
  monthMatrix,
  minutesOf,
} from "./calendar";

const event = (title, time, endTime = "") => ({
  id: title,
  title,
  when: { mode: "event", date: "2026-09-09", time, endTime },
});

const columnsOf = (blocks) =>
  Object.fromEntries(
    blocks.map((block) => [block.item.title, [block.column, block.columns]])
  );

test("events that do not overlap each get the full width", () => {
  const laid = layoutTimed([
    event("morning", "09:00", "10:00"),
    event("afternoon", "14:00", "15:00"),
  ]);

  expect(columnsOf(laid)).toEqual({
    morning: [0, 1],
    afternoon: [0, 1],
  });
});

test("overlapping events split into side-by-side columns", () => {
  const laid = layoutTimed([
    event("a", "09:00", "11:00"),
    event("b", "10:00", "12:00"),
    event("c", "10:30", "11:30"),
  ]);

  const columns = columnsOf(laid);
  expect(columns.a).toEqual([0, 3]);
  expect(columns.b).toEqual([1, 3]);
  expect(columns.c).toEqual([2, 3]);
});

test("a freed column is reused rather than widening the cluster", () => {
  const laid = layoutTimed([
    event("a", "09:00", "10:00"),
    event("b", "09:30", "11:00"),
    event("c", "10:00", "11:00"),
  ]);

  const columns = columnsOf(laid);
  expect(columns.a).toEqual([0, 2]);
  expect(columns.b).toEqual([1, 2]);
  expect(columns.c).toEqual([0, 2]);
});

test("a gap starts a fresh cluster", () => {
  const laid = layoutTimed([
    event("a", "09:00", "10:00"),
    event("b", "09:30", "10:00"),
    event("late", "15:00", "16:00"),
  ]);

  const columns = columnsOf(laid);
  expect(columns.a[1]).toBe(2);
  expect(columns.b[1]).toBe(2);
  expect(columns.late).toEqual([0, 1]);
});

test("an event with no end time gets a default block, with a floor on length", () => {
  const [open] = layoutTimed([event("open", "09:00")]);
  expect(open.start).toBe(540);
  expect(open.end).toBe(600);

  const [backwards] = layoutTimed([event("backwards", "09:00", "08:00")]);
  expect(backwards.end).toBeGreaterThan(backwards.start);
});

test("deadlines stay out of the hour grid even when they have a time", () => {
  const due = {
    id: "d",
    title: "pset",
    when: { mode: "due", date: "2026-09-09", time: "15:00", endTime: "" },
  };
  expect(layoutTimed([due])).toEqual([]);
});

test("the hour window widens to fit anything outside the default", () => {
  expect(hourRange([])).toEqual({ start: 8, end: 20 });

  const early = layoutTimed([event("dawn", "06:30", "07:00")]);
  expect(hourRange(early).start).toBe(6);

  const late = layoutTimed([event("night", "21:00", "22:30")]);
  expect(hourRange(late).end).toBe(23);
});

test("a week runs Sunday to Saturday around the given day", () => {
  const days = weekMatrix("2026-09-09");
  expect(days).toHaveLength(7);
  expect(days[0].key).toBe("2026-09-06");
  expect(days[0].weekday).toBe("Sun");
  expect(days[6].key).toBe("2026-09-12");
  expect(days[6].weekday).toBe("Sat");
  expect(days[0].isWeekend).toBe(true);
  expect(days[3].isWeekend).toBe(false);
});

test("stepping weeks crosses month boundaries", () => {
  expect(shiftWeek("2026-09-09", 1)).toBe("2026-09-16");
  expect(shiftWeek("2026-10-01", -1)).toBe("2026-09-24");
});

test("the week label collapses a shared month", () => {
  expect(weekLabel(weekMatrix("2026-09-09"))).toBe("Sep 6 – 12, 2026");
  expect(weekLabel(weekMatrix("2026-10-01"))).toBe("Sep 27 – Oct 3, 2026");
});

test("a month is always six full weeks", () => {
  const weeks = monthMatrix(2026, 8);
  expect(weeks).toHaveLength(6);
  weeks.forEach((week) => expect(week).toHaveLength(7));
  expect(weeks[0][0].key).toBe("2026-08-30");
  expect(weeks[0][0].inMonth).toBe(false);
  expect(weeks[0][2].key).toBe("2026-09-01");
  expect(weeks[0][2].inMonth).toBe(true);
});

test("minutesOf counts from midnight", () => {
  expect(minutesOf("00:00")).toBe(0);
  expect(minutesOf("09:30")).toBe(570);
  expect(minutesOf("23:59")).toBe(1439);
});
