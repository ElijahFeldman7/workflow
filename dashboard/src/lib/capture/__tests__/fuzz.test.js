import { captureText } from "../capture";
import { tokenize } from "../tokenize";
import { WORK_TYPE_IDS } from "../../../constants/work";

const now = new Date(2026, 8, 5);
const spaces = [
  { id: "s1", name: "AP Biology", kind: "class", teacher: "Nguyen", room: "214" },
  { id: "s2", name: "Computer Team", kind: "club" },
];

const ALPHABET = " abcdefghijklmnopqrstuvwxyz0123456789#/@*!:-\"',.";

function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const randomString = (random, maxLength) => {
  const length = Math.floor(random() * maxLength);
  let out = "";
  for (let index = 0; index < length; index += 1) {
    out += ALPHABET[Math.floor(random() * ALPHABET.length)];
  }
  return out;
};

const ADVERSARIAL = [
  "",
  " ",
  "\n\n",
  "\t",
  "!!!!!!!!!!",
  "####",
  "#",
  "/",
  "@",
  "*",
  '"',
  '""',
  '#"',
  '#""',
  "@:::",
  "-",
  "--",
  "0/0",
  "99/99/9999",
  "0000-00-00",
  "in 999 weeks",
  "999d",
  "the 0th",
  "3-",
  "-3pm",
  "to to to",
  "for for for",
  "next next next",
  "end of of the",
  "half past past",
  "quarter to to",
  "a".repeat(500),
  "bio ".repeat(200),
  "#bio ".repeat(100),
  "study",
  "cafe naive resume",
  "__proto__",
  "constructor",
  "toString",
  "prototype",
  "#__proto__",
  "/__proto__",
];

const isValid = (result) => {
  expect(typeof result.title).toBe("string");
  expect(typeof result.spaceId).toBe("string");
  expect(typeof result.newSpaceName).toBe("string");
  expect(typeof result.location).toBe("string");
  expect(["due", "event"]).toContain(result.mode);
  expect(["low", "medium", "high", "insane"]).toContain(result.priority);
  expect(["", ...WORK_TYPE_IDS]).toContain(result.type);
  expect(result.date === "" || /^\d{4}-\d{2}-\d{2}$/.test(result.date)).toBe(true);
  expect(result.time === "" || /^\d{2}:\d{2}$/.test(result.time)).toBe(true);
  expect(result.endTime === "" || /^\d{2}:\d{2}$/.test(result.endTime)).toBe(true);
  expect(typeof result.filled).toBe("object");
  expect(typeof result.confidence).toBe("object");
  expect(Array.isArray(result.spans)).toBe(true);
};

test("adversarial strings never throw and always return a valid shape", () => {
  ADVERSARIAL.forEach((text) => isValid(captureText(text, { spaces, now })));
});

test("2000 random strings never throw and always return a valid shape", () => {
  const random = makeRandom(20260905);
  for (let index = 0; index < 2000; index += 1) {
    isValid(captureText(randomString(random, 60), { spaces, now }));
  }
});

test("prototype keys in input cannot poison anything", () => {
  isValid(captureText("__proto__ #__proto__ toString", { spaces, now }));
  expect({}.polluted).toBeUndefined();
  expect(Object.prototype.polluted).toBeUndefined();
});

test("a title is only empty when the input carries no words of its own", () => {
  expect(captureText("", { spaces, now }).title).toBe("");
  expect(captureText("#bio /lab @3pm", { spaces, now }).title).toBe("");
  expect(captureText("bio", { spaces, now }).title).toBe("bio");
  expect(captureText("essay", { spaces, now }).title).toBe("essay");
});

test("spans never point outside the token list", () => {
  const random = makeRandom(7);
  for (let index = 0; index < 300; index += 1) {
    const text = randomString(random, 40);
    const tokenCount = tokenize(text).length;
    captureText(text, { spaces, now }).spans.forEach((span) => {
      expect(span.from).toBeGreaterThanOrEqual(0);
      expect(span.to).toBeLessThan(Math.max(tokenCount, 1));
      expect(span.to).toBeGreaterThanOrEqual(span.from);
      expect(span.confidence).toBeGreaterThan(0);
      expect(span.confidence).toBeLessThanOrEqual(1);
    });
  }
});

test("capture is a pure function that does not touch its inputs", () => {
  const text = "cell lab writeup for bio due friday";
  const first = captureText(text, { spaces, now });
  const second = captureText(text, { spaces, now });
  expect(second).toEqual(first);
  expect(spaces).toHaveLength(2);
  expect(spaces[0].name).toBe("AP Biology");
});
