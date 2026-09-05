import {
  memoryKey,
  lookup,
  recordCorrection,
  forget,
  normalizeMemory,
  memoryConfidence,
  emptyMemory,
} from "../memory";
import { captureText } from "../capture";

const now = new Date(2026, 8, 5);
const spaces = [
  { id: "s1", name: "AP Biology", kind: "class" },
  { id: "s2", name: "Ceramics", kind: "class" },
];

describe("keys", () => {
  test("are normalized so spelling and spacing do not matter", () => {
    expect(memoryKey("Ochem  Lab!", "space")).toBe(memoryKey("ochem lab", "space"));
  });

  test("are scoped per field", () => {
    expect(memoryKey("ochem", "space")).not.toBe(memoryKey("ochem", "type"));
  });

  test("are empty for unlearnable fields or empty phrases", () => {
    expect(memoryKey("ochem", "date")).toBe("");
    expect(memoryKey("", "space")).toBe("");
    expect(memoryKey("!!!", "space")).toBe("");
  });
});

describe("recording and reading", () => {
  test("a correction can be read back", () => {
    const memory = recordCorrection(emptyMemory(), "ochem", "space", "s2");
    expect(lookup(memory, "ochem", "space").value).toBe("s2");
    expect(lookup(memory, "OCHEM", "space").value).toBe("s2");
  });

  test("repeating the same correction raises confidence", () => {
    let memory = recordCorrection(emptyMemory(), "ochem", "space", "s2");
    const first = memoryConfidence(lookup(memory, "ochem", "space"));
    memory = recordCorrection(memory, "ochem", "space", "s2");
    memory = recordCorrection(memory, "ochem", "space", "s2");
    const later = memoryConfidence(lookup(memory, "ochem", "space"));
    expect(later).toBeGreaterThan(first);
    expect(later).toBeLessThanOrEqual(0.97);
  });

  test("changing the answer resets the count", () => {
    let memory = recordCorrection(emptyMemory(), "ochem", "space", "s2");
    memory = recordCorrection(memory, "ochem", "space", "s2");
    memory = recordCorrection(memory, "ochem", "space", "s1");
    expect(lookup(memory, "ochem", "space")).toMatchObject({ value: "s1", count: 1 });
  });

  test("recording never mutates the memory it was given", () => {
    const before = emptyMemory();
    const after = recordCorrection(before, "ochem", "space", "s2");
    expect(before).toEqual({});
    expect(after).not.toBe(before);
  });

  test("forget removes an entry", () => {
    const memory = recordCorrection(emptyMemory(), "ochem", "space", "s2");
    expect(lookup(forget(memory, "ochem", "space"), "ochem", "space")).toBe(null);
  });

  test("missing lookups are null, never a throw", () => {
    expect(lookup(null, "ochem", "space")).toBe(null);
    expect(lookup({}, "ochem", "space")).toBe(null);
    expect(lookup({ "space:ochem": {} }, "ochem", "space")).toBe(null);
  });
});

describe("normalizing what came back from the database", () => {
  test("keeps well formed rows and drops the rest", () => {
    const normalized = normalizeMemory({
      "space:ochem": { phrase: "ochem", field: "space", value: "s2", count: 3 },
      "space:bad": { phrase: "bad", field: "space" },
      "date:nope": { phrase: "nope", field: "date", value: "2026-01-01" },
      junk: "not an object",
    });
    expect(Object.keys(normalized)).toEqual(["space:ochem"]);
    expect(normalized["space:ochem"].count).toBe(3);
  });

  test("survives junk input", () => {
    expect(normalizeMemory(null)).toEqual({});
    expect(normalizeMemory("nope")).toEqual({});
    expect(normalizeMemory([])).toEqual({});
  });
});

describe("memory changes what the parser does", () => {
  test("a learned phrase tags a class the matcher would never find", () => {
    const before = captureText("ochem problem set friday", { spaces, now });
    expect(before.spaceId).toBe("");

    const memory = recordCorrection(emptyMemory(), "ochem", "space", "s2");
    const after = captureText("ochem problem set friday", { spaces, now, memory });
    expect(after.spaceId).toBe("s2");
    expect(after.confidence.space).toBeGreaterThan(0.85);
  });

  test("a learned phrase can override a wrong guess", () => {
    const before = captureText("bio thing tomorrow", { spaces, now });
    expect(before.spaceId).toBe("s1");

    const memory = recordCorrection(emptyMemory(), "bio", "space", "s2");
    const after = captureText("bio thing tomorrow", { spaces, now, memory });
    expect(after.spaceId).toBe("s2");
  });

  test("learning a type works the same way", () => {
    const memory = recordCorrection(emptyMemory(), "wkst", "type", "hw");
    expect(captureText("wkst 5 friday", { spaces, now, memory }).type).toBe("hw");
  });

  test("an empty memory changes nothing", () => {
    const plain = captureText("cell lab friday", { spaces, now });
    const withMemory = captureText("cell lab friday", {
      spaces,
      now,
      memory: emptyMemory(),
    });
    expect(withMemory).toEqual(plain);
  });
});
