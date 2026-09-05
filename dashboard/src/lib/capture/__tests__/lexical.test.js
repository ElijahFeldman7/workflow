import { encode, features, DIMS } from "../embed/lexical";
import { cosine } from "../embed/cosine";
import { lexicalEncoder } from "../embed";

const sim = (a, b) => cosine(encode(a), encode(b));

describe("vector shape", () => {
  test("every vector has the declared width", () => {
    expect(encode("ap biology").length).toBe(DIMS);
    expect(lexicalEncoder.dims).toBe(DIMS);
  });

  test("vectors are unit length", () => {
    ["ap biology", "x", "a much longer phrase with several words"].forEach(
      (text) => {
        const vector = encode(text);
        const norm = Math.sqrt(
          vector.reduce((sum, value) => sum + value * value, 0)
        );
        expect(norm).toBeCloseTo(1, 5);
      }
    );
  });

  test("empty input gives a zero vector rather than throwing", () => {
    const vector = encode("");
    expect(vector.length).toBe(DIMS);
    expect(vector.every((value) => value === 0)).toBe(true);
    expect(encode(null).every((value) => value === 0)).toBe(true);
    expect(encode("!!! ???").every((value) => value === 0)).toBe(true);
  });

  test("encoding is deterministic", () => {
    expect(Array.from(encode("ap biology"))).toEqual(
      Array.from(encode("ap biology"))
    );
  });

  test("punctuation and case do not change the vector", () => {
    expect(sim("AP Biology", "ap  biology!")).toBeCloseTo(1, 5);
  });

  test("features carry word unigrams plus character bigrams and trigrams", () => {
    const kinds = new Set(features("bio").map((f) => f.feature[0]));
    expect(kinds).toEqual(new Set(["w", "b", "t"]));
  });
});

describe("similarity behaves like a metric people expect", () => {
  test("a phrase is identical to itself", () => {
    expect(sim("ap biology", "ap biology")).toBeCloseTo(1, 5);
  });

  test("cosine is symmetric", () => {
    expect(sim("ap biology", "ap bio")).toBeCloseTo(sim("ap bio", "ap biology"), 6);
  });

  test("an empty side scores zero, not NaN", () => {
    expect(sim("", "ap biology")).toBe(0);
    expect(Number.isNaN(sim("", ""))).toBe(false);
  });

  test("mismatched widths score zero instead of throwing", () => {
    expect(cosine(new Float32Array(4), new Float32Array(8))).toBe(0);
    expect(cosine(null, encode("bio"))).toBe(0);
  });
});

describe("the separations the resolver depends on", () => {
  const TYPO = sim("biology", "bioloy");
  const ABBREV = sim("ap biology", "ap bio");
  const SHORT = sim("bioloy", "AP Biology");
  const STEM = sim("multivar", "Multivariable Calculus");
  const UNRELATED = sim("ap biology", "computer team");
  const DISJOINT = sim("chem", "AP Biology");

  test("typos stay close to the word they meant", () => {
    expect(TYPO).toBeGreaterThan(0.5);
  });

  test("abbreviations stay close to the full name", () => {
    expect(ABBREV).toBeGreaterThan(0.5);
    expect(STEM).toBeGreaterThan(0.45);
  });

  test("a misspelled abbreviation still clears the space threshold", () => {
    expect(SHORT).toBeGreaterThan(0.42);
  });

  test("unrelated names share nothing", () => {
    expect(UNRELATED).toBeLessThan(0.1);
    expect(DISJOINT).toBeLessThan(0.1);
  });

  test("every true pair outscores every false pair by a wide margin", () => {
    const truePairs = [TYPO, ABBREV, SHORT, STEM];
    const falsePairs = [UNRELATED, DISJOINT];
    expect(Math.min(...truePairs)).toBeGreaterThan(Math.max(...falsePairs) + 0.3);
  });
});
