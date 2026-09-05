import { findTimes, findDurations, parseTimeToken, parseClock, addMinutes } from "../extractors/times";
import { selectSpans } from "../spans";
import { tokenize } from "../tokenize";

const timeOf = (text) => {
  const spans = selectSpans(findTimes(tokenize(text)));
  return spans.length ? spans[0] : null;
};

describe("parseClock", () => {
  const cases = [
    ["3pm", "15:00"],
    ["3 pm", "15:00"],
    ["3:30pm", "15:30"],
    ["12am", "00:00"],
    ["12pm", "12:00"],
    ["15:00", "15:00"],
    ["09:05", "09:05"],
    ["23:59", "23:59"],
    ["noon", "12:00"],
    ["midnight", "00:00"],
  ];
  cases.forEach(([input, expected]) =>
    test(`${input} -> ${expected}`, () => expect(parseClock(input)).toBe(expected))
  );

  const rejected = ["3", "25:00", "3:99", "13pm", "0pm", "banana", ""];
  rejected.forEach((input) =>
    test(`${JSON.stringify(input)} is rejected`, () =>
      expect(parseClock(input)).toBe(null))
  );
});

describe("ranges", () => {
  test("carries the meridiem backwards across a range", () => {
    expect(parseTimeToken("3-4:30pm")).toEqual({
      time: "15:00",
      endTime: "16:30",
      isRange: true,
    });
  });

  test("accepts to, until and dashes", () => {
    expect(parseTimeToken("3pm to 5pm").time).toBe("15:00");
    expect(parseTimeToken("3pm until 5pm").endTime).toBe("17:00");
    expect(parseTimeToken("9:00-10:30")).toEqual({
      time: "09:00",
      endTime: "10:30",
      isRange: true,
    });
  });

  test("a range is flagged so the caller can make it an event", () => {
    expect(timeOf("3-5pm").isRange).toBe(true);
    expect(timeOf("3pm").isRange).toBe(false);
  });
});

describe("multi word times", () => {
  const cases = [
    ["from 3 to 4pm", "15:00", "16:00"],
    ["at 3:30pm", "15:30", ""],
    ["half past 2", "02:30", ""],
    ["quarter past 3", "03:15", ""],
    ["quarter to 5", "04:45", ""],
    ["quarter to 1", "12:45", ""],
  ];
  cases.forEach(([input, time, endTime]) =>
    test(`${input} -> ${time}${endTime ? `-${endTime}` : ""}`, () => {
      const span = timeOf(input);
      expect(span.value).toBe(time);
      expect(span.endTime || "").toBe(endTime);
    })
  );
});

describe("confidence guards against bare numbers", () => {
  test("an explicit time is confident", () => {
    expect(timeOf("3pm").confidence).toBeGreaterThan(0.9);
    expect(timeOf("15:00").confidence).toBeGreaterThan(0.9);
  });

  test("bare numbers never become a time, alone or as a range", () => {
    expect(timeOf("chapter 3 to 4")).toBe(null);
    expect(timeOf("chapter 7")).toBe(null);
    expect(timeOf("unit 1")).toBe(null);
    expect(timeOf("problems 3 to 12")).toBe(null);
  });

  test("adding a meridiem to either end makes it a time again", () => {
    expect(timeOf("3 to 4pm").value).toBe("15:00");
  });
});

describe("durations", () => {
  const cases = [
    ["for 2 hours", 120],
    ["for 90 min", 90],
    ["for 1.5h", 90],
    ["2h", 120],
    ["45m", 45],
    ["for 30 minutes", 30],
  ];
  cases.forEach(([input, minutes]) =>
    test(`${input} -> ${minutes} minutes`, () => {
      const spans = selectSpans(findDurations(tokenize(input)));
      expect(spans[0].value).toBe(minutes);
    })
  );

  test("nonsense durations are rejected", () => {
    expect(findDurations(tokenize("for 0 hours"))).toEqual([]);
    expect(findDurations(tokenize("for 900 hours"))).toEqual([]);
  });
});

describe("addMinutes", () => {
  test("adds within the day", () => expect(addMinutes("15:00", 90)).toBe("16:30"));
  test("wraps past midnight", () => expect(addMinutes("23:30", 60)).toBe("00:30"));
});
