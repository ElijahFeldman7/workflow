import {
  matchSpaces,
  ladderSpace,
  resolveSpace,
  resolveType,
  buildSpaceIndex,
  spaceDocument,
  THRESHOLDS,
} from "../resolve";

const spaces = [
  { id: "s1", name: "AP Biology", kind: "class", teacher: "Nguyen", room: "214" },
  { id: "s2", name: "Computer Team", kind: "club" },
  { id: "s3", name: "Multivariable Calculus", kind: "class" },
  { id: "s4", name: "AP Physics", kind: "class" },
];

describe("the exact match ladder", () => {
  const cases = [
    ["AP Biology", "s1", 0],
    ["ap", "s1", 1],
    ["biology", "s1", 2],
    ["bio", "s1", 2],
    ["ct", "s2", 3],
    ["multivariable", "s3", 1],
    ["calculus", "s3", 2],
  ];
  cases.forEach(([query, id, score]) =>
    test(`${query} -> ${id} at rung ${score}`, () => {
      const hit = ladderSpace(query, spaces);
      expect(hit.space.id).toBe(id);
      expect(hit.score).toBe(score);
    })
  );

  test("earlier rungs are more confident than later ones", () => {
    const exact = ladderSpace("AP Biology", spaces).confidence;
    const wordPrefix = ladderSpace("biology", spaces).confidence;
    const initials = ladderSpace("ct", spaces).confidence;
    expect(exact).toBeGreaterThan(wordPrefix);
    expect(wordPrefix).toBeGreaterThan(initials);
  });

  test("nothing matches an unrelated query", () => {
    expect(ladderSpace("ceramics", spaces)).toBe(null);
    expect(matchSpaces("", spaces)).toEqual([]);
    expect(matchSpaces("bio", [])).toEqual([]);
  });

  test("maxScore keeps loose rungs out", () => {
    expect(ladderSpace("apbg", spaces, 4).space.id).toBe("s1");
    expect(ladderSpace("apbg", spaces, 3)).toBe(null);
  });
});

describe("the semantic fallback", () => {
  test("a misspelling resolves when the strict ladder cannot", () => {
    expect(ladderSpace("bioloy", spaces, 3)).toBe(null);
    expect(resolveSpace("bioloy", spaces, { maxScore: 3 }).spaceId).toBe("s1");
  });

  test("the loosest ladder rung is subsequence matching, and it is least confident", () => {
    const loose = ladderSpace("bioloy", spaces);
    expect(loose.score).toBe(4);
    expect(loose.confidence).toBeLessThan(
      ladderSpace("bio", spaces).confidence
    );
  });

  test("it stays below the ladder in confidence", () => {
    const exact = resolveSpace("AP Biology", spaces).confidence;
    const fuzzy = resolveSpace("bioloy", spaces, { maxScore: 3 }).confidence;
    expect(fuzzy).toBeLessThan(exact);
  });

  test("an unrelated phrase resolves to nothing", () => {
    expect(resolveSpace("ceramics studio", spaces, { maxScore: -1 })).toBe(null);
    expect(resolveSpace("", spaces)).toBe(null);
    expect(resolveSpace("anything", [])).toBe(null);
  });

  test("the teacher and room are searchable, below the name", () => {
    expect(spaceDocument(spaces[0])).toBe("AP Biology class Nguyen 214");
    expect(resolveSpace("nguyen", spaces, { maxScore: -1 }).spaceId).toBe("s1");
  });

  test("a prebuilt index gives the same answer as building one inline", () => {
    const spaceIndex = buildSpaceIndex(spaces);
    expect(
      resolveSpace("bioloy", spaces, { spaceIndex, maxScore: 3 }).spaceId
    ).toBe(resolveSpace("bioloy", spaces, { maxScore: 3 }).spaceId);
  });
});

describe("type resolution", () => {
  test("a close phrase resolves", () => {
    expect(resolveType("essay").type).toBe("application");
  });

  test("unrelated words resolve to nothing", () => {
    ["kinematics", "counselor", "orchestra"].forEach((word) =>
      expect(resolveType(word)).toBe(null)
    );
  });

  test("other is never guessed, only chosen explicitly", () => {
    const guesses = ["misc thing", "general stuff", "whatever"]
      .map((word) => resolveType(word))
      .filter(Boolean);
    guesses.forEach((guess) => expect(guess.type).not.toBe("other"));
  });
});

test("the thresholds are the ones the extractors were tuned against", () => {
  expect(THRESHOLDS.SPACE_SIM_MIN).toBeCloseTo(0.42, 5);
  expect(THRESHOLDS.TYPE_SIM_MIN).toBeCloseTo(0.38, 5);
});
