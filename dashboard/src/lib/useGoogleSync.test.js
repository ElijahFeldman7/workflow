import fs from "fs";
import nodePath from "path";
import { renderHook, act } from "@testing-library/react";
import { ref, get, set, update, remove } from "firebase/database";
import { useGoogleSync } from "./useGoogleSync";
import { listEvents, hasToken, connect, listCalendars } from "./googleCalendar";
import { todayKey } from "../constants/work";

jest.mock("./googleCalendar", () => ({
  GoogleAuthRequired: class GoogleAuthRequired extends Error {},
  GoogleScopeDenied: class GoogleScopeDenied extends Error {},
  GoogleStaleGrant: class GoogleStaleGrant extends Error {},
  clearToken: jest.fn(),
  connect: jest.fn(),
  eventToCache: jest.requireActual("./googleCalendar").eventToCache,
  hasToken: jest.fn(() => false),
  listCalendars: jest.fn(() => Promise.resolve([])),
  listEvents: jest.fn(),
}));

const user = { uid: "u1" };
const today = todayKey();

const googleEvent = (overrides = {}) => ({
  id: "e1",
  status: "confirmed",
  summary: "Private Lesson",
  start: { dateTime: `${today}T15:00:00` },
  end: { dateTime: `${today}T16:00:00` },
  ...overrides,
});

let config;

const setup = () => {
  get.mockResolvedValue({ val: () => config });
  return renderHook(() => useGoogleSync(user));
};

const writesTo = (suffix) =>
  set.mock.calls
    .filter(([target]) => String(target.path).endsWith(suffix))
    .map(([, payload]) => payload);

beforeEach(() => {
  ref.mockImplementation((db, path) => ({ path: path || "" }));
  set.mockResolvedValue();
  update.mockResolvedValue();
  remove.mockResolvedValue();
  hasToken.mockReturnValue(true);
  listCalendars.mockResolvedValue([]);
  connect.mockResolvedValue("token");
  listEvents.mockResolvedValue({ events: [] });
  config = { calendarId: "cal1", calendarName: "Primary", autoSync: false };
});

describe("the sync cannot reach the work list", () => {
  it("never writes anywhere near users/<uid>/work", async () => {
    listEvents.mockResolvedValue({
      events: [googleEvent(), googleEvent({ id: "e2", summary: "Dentist" })],
    });

    const { result } = setup();
    await act(() => result.current.syncNow());

    // The property that matters. Every earlier disaster was this sync
    // creating, rewriting or deleting rows the user owned.
    const touched = [
      ...set.mock.calls,
      ...update.mock.calls,
      ...remove.mock.calls,
    ].map(([target]) => String(target.path));

    expect(touched.length).toBeGreaterThan(0);
    touched.forEach((written) => expect(written).not.toMatch(/\/work(\/|$)/));
  });

  it("has no code that could write there", () => {
    const source = fs.readFileSync(
      nodePath.join(__dirname, "useGoogleSync.js"),
      "utf8"
    );
    // A path built from the work node, in any spelling, has no business here.
    expect(source).not.toMatch(/users\/\$\{[^}]*\}\/work/);
    expect(source).not.toMatch(/workPath/);
    // Firebase push() creates rows. Array.push is fine; the import is not.
    const firebaseImport = /import \{([^}]*)\} from "firebase\/database"/.exec(
      source
    );
    expect(firebaseImport).toBeTruthy();
    expect(firebaseImport[1]).not.toMatch(/\bpush\b/);
  });
});

describe("reading a calendar", () => {
  it("stores what it read under the calendar cache", async () => {
    listEvents.mockResolvedValue({
      events: [googleEvent({ id: "e1", summary: "Private Lesson" })],
    });

    const { result } = setup();
    await act(() => result.current.syncNow());

    const [written] = writesTo("/googleEvents");
    expect(Object.keys(written)).toEqual(["e1"]);
    expect(written.e1).toMatchObject({
      title: "Private Lesson",
      start: { dateTime: new Date(`${today}T15:00:00`).toISOString() },
      end: { dateTime: new Date(`${today}T16:00:00`).toISOString() },
    });
  });

  it("keeps repeating events, which used to be dropped", async () => {
    listEvents.mockResolvedValue({
      events: [
        googleEvent({ id: "r1", recurringEventId: "series", summary: "USACO" }),
        googleEvent({ id: "r2", recurringEventId: "series", summary: "USACO" }),
      ],
    });

    const { result } = setup();
    await act(() => result.current.syncNow());

    const [written] = writesTo("/googleEvents");
    expect(Object.keys(written)).toHaveLength(2);
    expect(written.r1.recurring).toBe(true);
  });

  it("asks for a bounded window, so a yearly event cannot run to 2056", async () => {
    const { result } = setup();
    await act(() => result.current.syncNow());

    const [, params] = listEvents.mock.calls[0];
    expect(params.timeMin).toBeTruthy();
    expect(params.timeMax).toBeTruthy();
    const span =
      new Date(params.timeMax).getTime() - new Date(params.timeMin).getTime();
    expect(span).toBeLessThan(365 * 864e5);
  });

  it("keeps an all-day event as all-day", async () => {
    listEvents.mockResolvedValue({
      events: [googleEvent({ id: "a1", start: { date: today }, end: undefined })],
    });

    const { result } = setup();
    await act(() => result.current.syncNow());

    expect(writesTo("/googleEvents")[0].a1.start).toEqual({ date: today });
  });

  it("skips an event with no usable start", async () => {
    listEvents.mockResolvedValue({
      events: [googleEvent({ id: "bad", start: undefined, end: undefined })],
    });

    const { result } = setup();
    await act(() => result.current.syncNow());

    expect(writesTo("/googleEvents")[0]).toEqual({});
  });
});

describe("a deletion in Google needs no handling", () => {
  it("simply is not in the next write", async () => {
    listEvents.mockResolvedValue({
      events: [googleEvent({ id: "keep" }), googleEvent({ id: "goes" })],
    });
    const { result } = setup();
    await act(() => result.current.syncNow());
    expect(Object.keys(writesTo("/googleEvents")[0]).sort()).toEqual([
      "goes",
      "keep",
    ]);

    // Google stops returning one of them.
    set.mockClear();
    listEvents.mockResolvedValue({ events: [googleEvent({ id: "keep" })] });
    await act(() => result.current.syncNow());

    // Replaced outright, so the gone event is gone: no cancellation rows, no
    // sync token, no per-item bookkeeping left to get wrong.
    expect(Object.keys(writesTo("/googleEvents")[0])).toEqual(["keep"]);
  });

  it("drops the cache when the calendar is disconnected", async () => {
    const { result } = setup();
    await act(() => result.current.disconnectGoogle());

    expect(writesTo("/googleEvents")).toEqual([null]);
  });
});

describe("running it twice at once", () => {
  it("reads only once", async () => {
    const { result } = setup();
    await act(async () => {
      await Promise.all([result.current.syncNow(), result.current.syncNow()]);
    });
    expect(listEvents).toHaveBeenCalledTimes(1);
  });

  it("frees the claim after a failure", async () => {
    listEvents.mockRejectedValueOnce(new Error("network"));
    const { result } = setup();

    await act(() => result.current.syncNow());
    expect(result.current.status).toBe("error");

    listEvents.mockResolvedValue({ events: [] });
    await act(() => result.current.syncNow());
    expect(listEvents).toHaveBeenCalledTimes(2);
  });
});

describe("changing your mind while Google is still answering", () => {
  const deferred = () => {
    let resolve;
    const promise = new Promise((done) => {
      resolve = done;
    });
    return { promise, resolve };
  };

  it("throws away a pull for the calendar you switched from", async () => {
    const slow = deferred();
    listEvents.mockReturnValueOnce(slow.promise);
    listCalendars.mockResolvedValue([
      { id: "cal1", name: "Primary", primary: true },
      { id: "cal2", name: "School", primary: false },
    ]);

    const { result } = setup();
    let pull;
    await act(async () => {
      pull = result.current.syncNow();
      await Promise.resolve();
    });

    await act(() => result.current.chooseCalendar("cal2"));
    config = { ...config, calendarId: "cal2" };
    set.mockClear();
    listEvents.mockResolvedValue({
      events: [googleEvent({ id: "new", summary: "Assembly" })],
    });

    await act(async () => {
      slow.resolve({ events: [googleEvent({ id: "old" })] });
      await pull;
    });
    await act(async () => {});

    // The old calendar's answer never lands, and the new one is read at once
    // instead of waiting for the next tick.
    const written = writesTo("/googleEvents");
    expect(written).toHaveLength(1);
    expect(Object.keys(written[0])).toEqual(["new"]);
    expect(listEvents.mock.calls[1][0]).toBe("cal2");
  });

  it("does not bring events back after a disconnect", async () => {
    const slow = deferred();
    listEvents.mockReturnValueOnce(slow.promise);

    const { result } = setup();
    let pull;
    await act(async () => {
      pull = result.current.syncNow();
      await Promise.resolve();
    });

    await act(() => result.current.disconnectGoogle());
    config = null;
    set.mockClear();
    update.mockClear();

    await act(async () => {
      slow.resolve({ events: [googleEvent({ id: "old" })] });
      await pull;
    });
    await act(async () => {});

    expect(writesTo("/googleEvents")).toEqual([]);
    expect(update).not.toHaveBeenCalled();
  });
});
