import { tokenize, normalizeWord, normalizePhrase, words } from "../tokenize";

test("splits on whitespace and records offsets", () => {
  const tokens = tokenize("cell lab writeup");
  expect(tokens.map((t) => t.raw)).toEqual(["cell", "lab", "writeup"]);
  expect(tokens.map((t) => t.start)).toEqual([0, 5, 9]);
  expect(tokens.map((t) => t.end)).toEqual([4, 8, 16]);
  expect(tokens.map((t) => t.index)).toEqual([0, 1, 2]);
});

test("keeps a quoted run as one token and strips the quotes", () => {
  const tokens = tokenize('add "AP Biology" today');
  expect(tokens.map((t) => t.text)).toEqual(["add", "AP Biology", "today"]);
  expect(tokens[1].quoted).toBe(true);
  expect(tokens[1].raw).toBe('"AP Biology"');
});

test("keeps a sigil with a quoted value as one token", () => {
  const tokens = tokenize('essay #"AP Biology" fri');
  expect(tokens.map((t) => t.raw)).toEqual(["essay", '#"AP Biology"', "fri"]);
});

test("normalizes away surrounding punctuation but keeps the inside", () => {
  expect(normalizeWord("Friday,")).toBe("friday");
  expect(normalizeWord("(bio)")).toBe("bio");
  expect(normalizeWord("3:30pm")).toBe("3:30pm");
  expect(normalizeWord("3-4:30pm")).toBe("3-4:30pm");
  expect(normalizeWord("#bio")).toBe("bio");
  expect(normalizeWord("!!!")).toBe("");
});

test("normalizePhrase collapses everything that is not a letter or digit", () => {
  expect(normalizePhrase("AP  Biology!")).toBe("ap biology");
  expect(normalizePhrase("  ")).toBe("");
  expect(normalizePhrase(null)).toBe("");
});

test("handles empty and non-string input", () => {
  expect(tokenize("")).toEqual([]);
  expect(tokenize(null)).toEqual([]);
  expect(tokenize(undefined)).toEqual([]);
  expect(tokenize("   ")).toEqual([]);
});

test("words slices a normalized window", () => {
  const tokens = tokenize("read chapter 7 bio");
  expect(words(tokens, 1, 3)).toEqual(["chapter", "7", "bio"]);
});

test("is reusable across calls despite the shared regex", () => {
  expect(tokenize("a b").length).toBe(2);
  expect(tokenize("a b").length).toBe(2);
  expect(tokenize("x y z").length).toBe(3);
});
