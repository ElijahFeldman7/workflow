import { ref, set } from "firebase/database";
import {
  safeKey,
  expandCached,
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

describe("an event that runs over more than one day", () => {
  const local = (key, hour, minute = 0) => {
    const [year, month, day] = key.split("-").map(Number);
    return new Date(year, month - 1, day, hour, minute).toISOString();
  };

  it("shows a timed event at this device's clock time", () => {
    const [entry] = expandCached("e1", {
      title: "Lesson",
      start: { dateTime: local("2026-09-09", 15) },
      end: { dateTime: local("2026-09-09", 16, 30) },
    });

    expect(entry.when).toEqual({
      mode: "event",
      date: "2026-09-09",
      time: "15:00",
      endTime: "16:30",
    });
    expect(entry.allDay).toBe(false);
  });

  it("puts an all-day span on every day it covers", () => {
    // Google's end date is the morning after the last day.
    const entries = expandCached("trip", {
      title: "Trip",
      start: { date: "2026-09-09" },
      end: { date: "2026-09-12" },
    });

    expect(entries.map((entry) => entry.when.date)).toEqual([
      "2026-09-09",
      "2026-09-10",
      "2026-09-11",
    ]);
    expect(entries.every((entry) => entry.allDay)).toBe(true);
    expect(entries.map((entry) => entry.id)).toEqual([
      "gcal:trip",
      "gcal:trip@2026-09-10",
      "gcal:trip@2026-09-11",
    ]);
  });

  it("keeps a one-day all-day event to its one day", () => {
    expect(
      expandCached("d", {
        start: { date: "2026-09-09" },
        end: { date: "2026-09-10" },
      })
    ).toHaveLength(1);
  });

  it("splits a timed event at midnight", () => {
    const entries = expandCached("night", {
      title: "Lock-in",
      start: { dateTime: local("2026-09-09", 22) },
      end: { dateTime: local("2026-09-11", 2) },
    });

    expect(entries.map((entry) => entry.when)).toEqual([
      { mode: "event", date: "2026-09-09", time: "22:00", endTime: "23:59" },
      { mode: "event", date: "2026-09-10", time: "", endTime: "" },
      { mode: "event", date: "2026-09-11", time: "00:00", endTime: "02:00" },
    ]);
  });

  it("keeps an event ending on the stroke of midnight to its own day", () => {
    const entries = expandCached("late", {
      start: { dateTime: local("2026-09-09", 21) },
      end: { dateTime: local("2026-09-10", 0) },
    });

    expect(entries).toHaveLength(1);
    expect(entries[0].when).toMatchObject({ time: "21:00", endTime: "23:59" });
  });

  it("drops a start that is not a moment", () => {
    expect(expandCached("bad", { start: { dateTime: "nonsense" } })).toEqual([]);
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
