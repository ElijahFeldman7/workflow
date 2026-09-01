import { parseQuick, activeToken, replaceToken } from "./quickParse";

// Monday, August 31 2026.
const now = new Date(2026, 7, 31);
const spaces = [
  { id: "s1", name: "AP Bio", color: "emerald" },
  { id: "s2", name: "Computer Team", color: "violet" },
];

const parse = (text) => parseQuick(text, { spaces, now });

test("sigils set every field", () => {
  const result = parse("Cell lab writeup #bio /lab @3pm !!!! fri");
  expect(result.title).toBe("Cell lab writeup");
  expect(result.spaceId).toBe("s1");
  expect(result.type).toBe("lab");
  expect(result.priority).toBe("insane");
  expect(result.time).toBe("15:00");
  expect(result.date).toBe("2026-09-04");
});

test("bare words work without sigils", () => {
  const result = parse("Cell lab writeup bio lab fri insane");
  expect(result.title).toBe("Cell lab writeup");
  expect(result.spaceId).toBe("s1");
  expect(result.type).toBe("lab");
  expect(result.priority).toBe("insane");
  expect(result.date).toBe("2026-09-04");
});

test("bare vocab in the middle of a title is left alone", () => {
  expect(parse("Read chapter 4 bio quiz fri").title).toBe("Read chapter 4");
  expect(parse("Test corrections #bio hw mon").title).toBe("Test corrections");
});

test("a class name is pulled out of the middle of a line", () => {
  const withMulti = [...spaces, { id: "s3", name: "Multivariable" }];
  const result = parseQuick("Multi WS2", { spaces: withMulti, now });
  expect(result.spaceId).toBe("s3");
  expect(result.title).toBe("WS2");

  // Never strips the only word there is.
  expect(parseQuick("bio", { spaces, now }).title).toBe("bio");
});

test("trailing stopwords are trimmed off the title", () => {
  expect(parse("Study for bio test friday").title).toBe("Study");
});

test("a time range makes it an event", () => {
  const result = parse("Activity Fair #comp 3-5pm 9/12 *Gym");
  expect(result.title).toBe("Activity Fair");
  expect(result.spaceId).toBe("s2");
  expect(result.mode).toBe("event");
  expect(result.time).toBe("15:00");
  expect(result.endTime).toBe("17:00");
  expect(result.date).toBe("2026-09-12");
  expect(result.location).toBe("Gym");
});

test("unmatched #name is offered as a new space", () => {
  const result = parse("Kickoff #robotics tmrw");
  expect(result.spaceId).toBe("");
  expect(result.newSpaceName).toBe("robotics");
  expect(result.date).toBe("2026-09-01");
});

test("relative and calendar dates", () => {
  expect(parse("essay in 2 weeks").date).toBe("2026-09-14");
  expect(parse("essay in 3d").date).toBe("2026-09-03");
  expect(parse("essay sep 12").date).toBe("2026-09-12");
  expect(parse("essay next fri").date).toBe("2026-09-04");
  expect(parse("essay today").date).toBe("2026-08-31");
  // A bare weekday never means today.
  expect(parse("essay mon").date).toBe("2026-09-07");
});

test("bare numbers are not times", () => {
  const result = parse("Problem set 3");
  expect(result.title).toBe("Problem set 3");
  expect(result.time).toBe("");
});

test("plain text gets defaults and nothing else", () => {
  const result = parse("email Mr. Chen");
  expect(result.title).toBe("email Mr. Chen");
  expect(result.type).toBe("hw");
  expect(result.priority).toBe("medium");
  expect(result.mode).toBe("due");
  expect(result.date).toBe("");
  expect(result.filled.type).toBe(false);
});

test("autocomplete finds the token under the caret", () => {
  const text = "lab writeup #bi fri";
  const token = activeToken(text, 15);
  expect(token.sigil).toBe("#");
  expect(token.query).toBe("bi");

  const next = replaceToken(text, token, "AP Bio");
  expect(next.text).toBe('lab writeup #"AP Bio" fri');
});
