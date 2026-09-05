import { findTypes } from "../extractors/types";
import { findPriorities } from "../extractors/priority";
import { findModes } from "../extractors/mode";
import { findLocations } from "../extractors/location";
import { findSigils } from "../extractors/sigils";
import { selectSpans } from "../spans";
import { tokenize } from "../tokenize";

const pick = (finder, text, ctx) => {
  const spans = selectSpans(finder(tokenize(text), ctx));
  return spans.length ? spans[0] : null;
};

describe("types", () => {
  const cases = [
    ["homework", "hw"],
    ["hw", "hw"],
    ["pset", "hw"],
    ["worksheet", "hw"],
    ["quiz", "quiz"],
    ["exam", "test"],
    ["midterm", "test"],
    ["lab", "lab"],
    ["reading", "reading"],
    ["annotate", "reading"],
    ["project", "project"],
    ["presentation", "project"],
    ["finals", "final"],
    ["lecture", "seminar"],
    ["apply", "application"],
  ];
  cases.forEach(([input, expected]) =>
    test(`${input} -> ${expected}`, () =>
      expect(pick(findTypes, input).value).toBe(expected))
  );

  test("the lexicon outranks the semantic guess", () => {
    const span = pick(findTypes, "quiz");
    expect(span.confidence).toBe(0.8);
    expect(span.similarity).toBeUndefined();
  });

  test("an unknown word close to a seed still resolves", () => {
    expect(pick(findTypes, "essay").value).toBe("application");
  });

  test("unrelated words resolve to nothing", () => {
    ["kinematics", "counselor", "orchestra", "cells"].forEach((word) =>
      expect(pick(findTypes, word)).toBe(null)
    );
  });
});

describe("priority", () => {
  const cases = [
    ["!", "low"],
    ["!!", "medium"],
    ["!!!", "high"],
    ["!!!!", "insane"],
    ["urgent", "high"],
    ["asap", "high"],
    ["critical", "insane"],
    ["whenever", "low"],
    ["no rush", "low"],
    ["top priority", "high"],
    ["super important", "insane"],
  ];
  cases.forEach(([input, expected]) =>
    test(`${input} -> ${expected}`, () =>
      expect(pick(findPriorities, input).value).toBe(expected))
  );

  test("bangs are the most confident signal there is", () => {
    expect(pick(findPriorities, "!!!").confidence).toBe(1);
  });

  test("a phrase beats the single word inside it", () => {
    expect(pick(findPriorities, "no rush").value).toBe("low");
  });
});

describe("mode", () => {
  test("markers are metadata and may leave the title", () => {
    const span = pick(findModes, "event");
    expect(span.value).toBe("event");
    expect(span.keep).toBeUndefined();
  });

  test("event nouns set the mode but stay in the title", () => {
    const span = pick(findModes, "fair");
    expect(span.value).toBe("event");
    expect(span.keep).toBe(true);
  });

  test("due words mark a deadline", () => {
    expect(pick(findModes, "due").value).toBe("due");
    expect(pick(findModes, "deadline").value).toBe("due");
  });

  test("turn in is a phrase that stays in the title", () => {
    const span = pick(findModes, "turn in");
    expect(span.value).toBe("due");
    expect(span.keep).toBe(true);
  });

  test("a marker outranks a noun in the same sentence", () => {
    expect(pick(findModes, "activity fair event").value).toBe("event");
  });
});

describe("locations", () => {
  test("finds a room number", () => {
    expect(pick(findLocations, "in room 214").value).toBe("room 214");
    expect(pick(findLocations, "rm 3B").value).toBe("rm 3B");
  });

  test("ignores prose that is not a room", () => {
    ["at the library", "in the gym", "room", "in chapter 3"].forEach((text) =>
      expect(pick(findLocations, text)).toBe(null)
    );
  });
});

describe("sigils", () => {
  test("each sigil maps to its field at full confidence", () => {
    const spans = findSigils(tokenize('#bio /lab @3pm *Gym'));
    expect(spans.map((s) => [s.field, s.value])).toEqual([
      ["space", "bio"],
      ["type", "lab"],
      ["time", "15:00"],
      ["location", "Gym"],
    ]);
    spans.forEach((span) => expect(span.confidence).toBe(1));
  });

  test("quoted sigil values keep their spaces", () => {
    expect(findSigils(tokenize('#"AP Biology"'))[0].value).toBe("AP Biology");
  });

  test("a sigil with an unusable value is dropped", () => {
    expect(findSigils(tokenize("/notatype"))).toEqual([]);
    expect(findSigils(tokenize("@notatime"))).toEqual([]);
    expect(findSigils(tokenize("#"))).toEqual([]);
  });

  test("a time range in a sigil is flagged as a range", () => {
    expect(findSigils(tokenize("@3-5pm"))[0]).toMatchObject({
      value: "15:00",
      endTime: "17:00",
      isRange: true,
    });
  });
});
