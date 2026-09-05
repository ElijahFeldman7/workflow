import { findDates } from "../extractors/dates";
import { selectSpans } from "../spans";
import { tokenize } from "../tokenize";

const NOW = new Date(2026, 8, 5);

const dateOf = (text) => {
  const spans = selectSpans(findDates(tokenize(text), { now: NOW }));
  return spans.length ? spans[0].value : null;
};

test("the frozen now is the Saturday the table assumes", () => {
  expect(NOW.getDay()).toBe(6);
});

describe("relative days", () => {
  const cases = [
    ["today", "2026-09-05"],
    ["tod", "2026-09-05"],
    ["tonight", "2026-09-05"],
    ["eod", "2026-09-05"],
    ["tomorrow", "2026-09-06"],
    ["tmrw", "2026-09-06"],
    ["tmw", "2026-09-06"],
    ["tmr", "2026-09-06"],
    ["yesterday", "2026-09-04"],
    ["yest", "2026-09-04"],
  ];
  cases.forEach(([input, expected]) =>
    test(`${input} -> ${expected}`, () => expect(dateOf(input)).toBe(expected))
  );
});

describe("weekdays roll forward, never onto today", () => {
  const cases = [
    ["sun", "2026-09-06"],
    ["monday", "2026-09-07"],
    ["tues", "2026-09-08"],
    ["wed", "2026-09-09"],
    ["thurs", "2026-09-10"],
    ["fri", "2026-09-11"],
    ["sat", "2026-09-12"],
  ];
  cases.forEach(([input, expected]) =>
    test(`${input} -> ${expected}`, () => expect(dateOf(input)).toBe(expected))
  );

  test("this <weekday> may land on today", () => {
    expect(dateOf("this saturday")).toBe("2026-09-05");
  });

  test("next <weekday> skips today", () => {
    expect(dateOf("next saturday")).toBe("2026-09-12");
    expect(dateOf("next friday")).toBe("2026-09-11");
  });

  test("last <weekday> looks backwards", () => {
    expect(dateOf("last friday")).toBe("2026-09-04");
    expect(dateOf("last saturday")).toBe("2026-08-29");
  });
});

describe("calendar dates", () => {
  const cases = [
    ["2026-12-25", "2026-12-25"],
    ["9/14", "2026-09-14"],
    ["9/14/26", "2026-09-14"],
    ["9/14/2026", "2026-09-14"],
    ["12/25", "2026-12-25"],
    ["sept 14", "2026-09-14"],
    ["september 14", "2026-09-14"],
    ["sep 14th", "2026-09-14"],
    ["14 sept", "2026-09-14"],
    ["the 14th", "2026-09-14"],
    ["the 1st", "2026-10-01"],
  ];
  cases.forEach(([input, expected]) =>
    test(`${input} -> ${expected}`, () => expect(dateOf(input)).toBe(expected))
  );

  test("a month that already passed rolls into next year", () => {
    expect(dateOf("3/1")).toBe("2027-03-01");
    expect(dateOf("march 1")).toBe("2027-03-01");
  });

  test("a day earlier this month rolls into next month", () => {
    expect(dateOf("the 2nd")).toBe("2026-10-02");
  });

  test("impossible dates are rejected", () => {
    expect(dateOf("13/40")).toBe(null);
    expect(dateOf("feb 30")).toBe(null);
    expect(dateOf("the 99th")).toBe(null);
  });
});

describe("offsets and coarse anchors", () => {
  const cases = [
    ["in 3 days", "2026-09-08"],
    ["in 1 day", "2026-09-06"],
    ["in 2 weeks", "2026-09-19"],
    ["in 3d", "2026-09-08"],
    ["in 2w", "2026-09-19"],
    ["3d", "2026-09-08"],
    ["2w", "2026-09-19"],
    ["in 1 month", "2026-10-05"],
    ["next week", "2026-09-12"],
    ["next month", "2026-10-05"],
    ["this weekend", "2026-09-05"],
    ["next weekend", "2026-09-12"],
    ["end of week", "2026-09-11"],
    ["end of the week", "2026-09-11"],
    ["end of month", "2026-09-30"],
    ["end of the month", "2026-09-30"],
  ];
  cases.forEach(([input, expected]) =>
    test(`${input} -> ${expected}`, () => expect(dateOf(input)).toBe(expected))
  );
});

describe("things that are not dates", () => {
  ["chapter", "4", "kinematics", "unit 1", "page 12", "lab"].forEach((input) =>
    test(`${input} finds nothing`, () => expect(dateOf(input)).toBe(null))
  );
});

test("finds a date in the middle of a sentence and reports its span", () => {
  const spans = findDates(tokenize("essay due friday about cells"), { now: NOW });
  expect(spans).toHaveLength(1);
  expect(spans[0]).toMatchObject({ field: "date", value: "2026-09-11", from: 2, to: 2 });
});

test("prefers the longest window at a position", () => {
  const spans = findDates(tokenize("next friday"), { now: NOW });
  expect(spans[0]).toMatchObject({ from: 0, to: 1, value: "2026-09-11" });
});
