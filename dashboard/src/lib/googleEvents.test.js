import { ref, set } from "firebase/database";
import {
  safeKey,
  normalizeCached,
  replaceGoogleEvents,
  clearGoogleEvents,
  googleEventsPath,
} from "./googleEvents";

beforeEach(() => {
  ref.mockImplementation((db, path) => ({ path: path || "" }));
  set.mockResolvedValue();
});

describe("keys Firebase will accept", () => {
  it("replaces the characters a key cannot hold", () => {
    // Firebase rejects . # $ [ ] / and Google is free to use them in an id.
    expect(safeKey("abc.def#ghi$jkl[mno]pqr/stu")).toBe(
      "abc_def_ghi_jkl_mno_pqr_stu"
    );
  });

  it("leaves an ordinary recurring instance id alone", () => {
    expect(safeKey("abc123_20260909T210000Z")).toBe("abc123_20260909T210000Z");
  });
});

describe("reading the cache back", () => {
  const stored = {
    title: "Private Lesson",
    notes: "bring the book",
    location: "Room 4",
    allDay: false,
    recurring: true,
    when: { mode: "event", date: "2026-09-09", time: "17:00", endTime: "18:00" },
  };

  it("marks the row as Google's, not something you own", () => {
    const entry = normalizeCached("e1", stored);

    expect(entry).toMatchObject({
      id: "gcal:e1",
      source: "google",
      origin: "google",
      title: "Private Lesson",
      recurring: true,
    });
    // No class, no type, nothing to tick: these are not your work.
    expect(entry.spaceId).toBe("");
    expect(entry.type).toBe("");
    expect(entry.done).toBe(false);
  });

  it("throws away a row with no usable date", () => {
    expect(normalizeCached("e1", { ...stored, when: { date: "nonsense" } })).toBeNull();
    expect(normalizeCached("e1", {})).toBeNull();
    expect(normalizeCached("e1", null)).toBeNull();
  });

  it("drops a malformed time rather than passing it on", () => {
    const entry = normalizeCached("e1", {
      ...stored,
      when: { date: "2026-09-09", time: "25:99", endTime: "" },
    });
    expect(entry.when.time).toBe("");
  });

  it("prefixes the id so it cannot collide with a work item", () => {
    expect(normalizeCached("abc", stored).id).toBe("gcal:abc");
  });
});

describe("writing the cache", () => {
  it("replaces the whole node in one write", async () => {
    await replaceGoogleEvents("u1", [
      { id: "e1", value: { title: "One" } },
      { id: "e2", value: { title: "Two" } },
    ]);

    expect(set).toHaveBeenCalledTimes(1);
    const [target, payload] = set.mock.calls[0];
    expect(target.path).toBe(googleEventsPath("u1"));
    expect(payload).toEqual({ e1: { title: "One" }, e2: { title: "Two" } });
  });

  it("writes an empty object when there is nothing, not nothing at all", async () => {
    await replaceGoogleEvents("u1", []);
    // An empty write is what clears out whatever was cached before.
    expect(set.mock.calls[0][1]).toEqual({});
  });

  it("skips entries with no id or no value", async () => {
    await replaceGoogleEvents("u1", [
      { id: "", value: { title: "no id" } },
      { id: "e2", value: null },
      { id: "e3", value: { title: "fine" } },
    ]);
    expect(set.mock.calls[0][1]).toEqual({ e3: { title: "fine" } });
  });

  it("clears by writing null", async () => {
    await clearGoogleEvents("u1");
    expect(set.mock.calls[0][1]).toBeNull();
  });

  it("only ever addresses its own node", async () => {
    await replaceGoogleEvents("u1", [{ id: "e1", value: { title: "One" } }]);
    await clearGoogleEvents("u1");

    set.mock.calls.forEach(([target]) => {
      expect(target.path).toBe("users/u1/googleEvents");
    });
  });
});
