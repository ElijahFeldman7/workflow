import { renderHook, act } from "@testing-library/react";
import { ref, get, update, push } from "firebase/database";
import { useGoogleSync } from "./useGoogleSync";
import {
  getEvent,
  listEvents,
  deleteEvent,
  hasToken,
} from "./googleCalendar";
import { todayKey, addDaysKey } from "../constants/work";

jest.mock("./googleCalendar", () => ({
  GoogleAuthRequired: class GoogleAuthRequired extends Error {},
  GoogleScopeDenied: class GoogleScopeDenied extends Error {},
  SyncTokenExpired: class SyncTokenExpired extends Error {},
  clearToken: jest.fn(),
  connect: jest.fn(),
  deleteEvent: jest.fn(() => Promise.resolve()),
  eventToItem: jest.requireActual("./googleCalendar").eventToItem,
  fingerprint: jest.requireActual("./googleCalendar").fingerprint,
  getEvent: jest.fn(),
  hasToken: jest.fn(() => false),
  itemToEvent: jest.requireActual("./googleCalendar").itemToEvent,
  listCalendars: jest.fn(() => Promise.resolve([])),
  listEvents: jest.fn(),
  localTimeZone: () => "UTC",
  workflowIdOf: jest.requireActual("./googleCalendar").workflowIdOf,
}));

const user = { uid: "u1" };
const today = todayKey();

const item = (overrides = {}) => ({
  id: "w1",
  title: "Activity Fair",
  spaceId: "",
  type: "",
  priority: "medium",
  done: false,
  notes: "",
  location: "",
  when: { mode: "event", date: today, time: "15:00", endTime: "16:00" },
  createdAt: 1,
  completedAt: 0,
  ...overrides,
});

const googleEvent = (overrides = {}) => ({
  id: "e1",
  status: "confirmed",
  summary: "Activity Fair",
  start: { dateTime: `${today}T15:00:00` },
  end: { dateTime: `${today}T16:00:00` },
  ...overrides,
});

let config;

const setup = (items) => {
  get.mockResolvedValue({ val: () => config });
  return renderHook(() => useGoogleSync(user, items, true));
};

// Writes are keyed by the path they went to, newest value wins.
const writesTo = (suffix) =>
  update.mock.calls
    .filter(([target]) => String(target.path).endsWith(suffix))
    .map(([, payload]) => payload);

const mergedWrite = (suffix) =>
  writesTo(suffix).reduce((all, payload) => ({ ...all, ...payload }), {});

beforeEach(() => {
  jest.clearAllMocks();
  ref.mockImplementation((db, path) => ({ path }));
  push.mockReturnValue({ key: "new1" });
  update.mockResolvedValue();
  hasToken.mockReturnValue(false);
  deleteEvent.mockResolvedValue();
  getEvent.mockResolvedValue(null);
  listEvents.mockResolvedValue({ events: [], nextSyncToken: "tok2" });
  config = {
    calendarId: "cal1",
    calendarName: "Primary",
    syncToken: "",
    autoSync: false,
    links: {},
  };
});

describe("a deletion in Google reaches the work list", () => {
  it("removes the item when Google reports the event cancelled", async () => {
    config.syncToken = "tok1";
    config.links = { w1: { eventId: "e1", fingerprint: "x", syncedAt: 1 } };
    listEvents.mockResolvedValue({
      events: [googleEvent({ status: "cancelled" })],
      nextSyncToken: "tok2",
    });

    const { result } = setup([item()]);
    await act(() => result.current.syncNow());

    expect(mergedWrite("/work")).toEqual({ w1: null });
    expect(mergedWrite("/links")).toEqual({ w1: null });
    // The event is already gone; do not ask Google to delete it again.
    expect(deleteEvent).not.toHaveBeenCalled();
  });

  it("asks Google directly about a linked event a full sync did not return", async () => {
    config.links = { w1: { eventId: "e1", fingerprint: "x", syncedAt: 1 } };
    listEvents.mockResolvedValue({ events: [], nextSyncToken: "tok2" });
    getEvent.mockResolvedValue(null); // 404: really gone

    const { result } = setup([item()]);
    await act(() => result.current.syncNow());

    expect(getEvent).toHaveBeenCalledWith("cal1", "e1");
    expect(mergedWrite("/work")).toEqual({ w1: null });
  });

  it("keeps the item when the event turns out to still be there", async () => {
    config.links = { w1: { eventId: "e1", fingerprint: "x", syncedAt: 1 } };
    listEvents.mockResolvedValue({ events: [], nextSyncToken: "tok2" });
    getEvent.mockResolvedValue(googleEvent());

    const { result } = setup([item()]);
    await act(() => result.current.syncNow());

    expect(mergedWrite("/work").w1).not.toBeNull();
  });

  it("never deletes an item dated outside the window it pulled", async () => {
    const old = addDaysKey(today, -200);
    config.links = { w1: { eventId: "e1", fingerprint: "x", syncedAt: 1 } };

    const { result } = setup([
      item({ when: { mode: "event", date: old, time: "", endTime: "" } }),
    ]);
    await act(() => result.current.syncNow());

    expect(getEvent).not.toHaveBeenCalled();
    expect(mergedWrite("/work")).toEqual({});
  });
});

describe("a move in Google reaches the work list", () => {
  it("takes the new date and time", async () => {
    const moved = addDaysKey(today, 3);
    config.syncToken = "tok1";
    config.links = { w1: { eventId: "e1", fingerprint: "x", syncedAt: 1 } };
    listEvents.mockResolvedValue({
      events: [
        googleEvent({
          start: { dateTime: `${moved}T09:30:00` },
          end: { dateTime: `${moved}T10:30:00` },
        }),
      ],
      nextSyncToken: "tok2",
    });

    const { result } = setup([item()]);
    await act(() => result.current.syncNow());

    expect(mergedWrite("/work").w1.when).toMatchObject({
      date: moved,
      time: "09:30",
      endTime: "10:30",
    });
  });
});

describe("events are never imported twice", () => {
  it("keeps the links it worked out when the sync then fails", async () => {
    config.links = {};
    listEvents.mockResolvedValue({
      events: [googleEvent({ id: "e1", summary: "Assembly" })],
      nextSyncToken: "tok2",
    });
    // Blows up on the final config write, after the pull has already worked
    // out which row belongs to which event.
    update.mockImplementation((target) =>
      String(target.path).endsWith("/googleCalendar")
        ? Promise.reject(new Error("network died"))
        : Promise.resolve()
    );

    const { result } = setup([item({ id: "w1", title: "Something else" })]);
    await act(() => result.current.syncNow());

    // Losing this link is what used to make the next run import a second copy.
    expect(mergedWrite("/links").new1).toMatchObject({ eventId: "e1" });
    expect(result.current.status).toBe("error");
  });

  it("re-adopts an event that still carries its item id", async () => {
    config.links = {}; // link records lost
    listEvents.mockResolvedValue({
      events: [
        googleEvent({
          extendedProperties: { private: { workflowItemId: "w1" } },
        }),
      ],
      nextSyncToken: "tok2",
    });

    const { result } = setup([item()]);
    await act(() => result.current.syncNow());

    // Neither a second work item nor a second Google event.
    expect(push).not.toHaveBeenCalled();
    expect(mergedWrite("/links").w1).toMatchObject({ eventId: "e1" });
  });

  it("claims a leftover event that matches an item exactly", async () => {
    config.links = {}; // the event predates id stamping
    listEvents.mockResolvedValue({
      events: [googleEvent()], // same title, date and times as the item
      nextSyncToken: "tok2",
    });

    const { result } = setup([item()]);
    await act(() => result.current.syncNow());

    expect(push).not.toHaveBeenCalled();
    expect(mergedWrite("/links").w1).toMatchObject({ eventId: "e1" });
  });

  it("still lets two genuinely repeated events through", async () => {
    config.links = {};
    listEvents.mockResolvedValue({
      events: [googleEvent({ id: "e1" }), googleEvent({ id: "e2" })],
      nextSyncToken: "tok2",
    });

    const { result } = setup([item()]);
    await act(() => result.current.syncNow());

    // The first claims the item; the second is still its own event.
    expect(mergedWrite("/links").w1).toMatchObject({ eventId: "e1" });
    expect(mergedWrite("/work").new1).toBeTruthy();
  });

  it("still creates an item for an event that is genuinely new", async () => {
    listEvents.mockResolvedValue({
      events: [googleEvent({ id: "e9", summary: "Assembly" })],
      nextSyncToken: "tok2",
    });

    const { result } = setup([]);
    await act(() => result.current.syncNow());

    expect(mergedWrite("/work").new1).toMatchObject({ title: "Assembly" });
  });
});

describe("two runs at once cannot both act on the same thing", () => {
  it("ignores a second run that starts while one is going", async () => {
    const { result } = setup([item()]);

    await act(async () => {
      await Promise.all([result.current.syncNow(), result.current.syncNow()]);
    });

    // Both used to get past the guard, because it was only claimed after an
    // await, and both then ran the whole sync.
    expect(listEvents).toHaveBeenCalledTimes(1);
  });

  it("frees the claim once a run fails, so the next one still works", async () => {
    listEvents.mockRejectedValueOnce(new Error("network"));

    const { result } = setup([item()]);
    await act(() => result.current.syncNow());
    expect(listEvents).toHaveBeenCalledTimes(1);

    // The claim was released, so a second run is not blocked out.
    listEvents.mockResolvedValue({ events: [], nextSyncToken: "tok2" });
    await act(() => result.current.syncNow());
    expect(listEvents).toHaveBeenCalledTimes(2);
  });
});

describe("clearing up duplicates a previous overlap left behind", () => {
  it("collapses items that ended up pointing at one event", async () => {
    config.links = {
      w1: { eventId: "e1", fingerprint: "x", syncedAt: 1 },
      w2: { eventId: "e1", fingerprint: "x", syncedAt: 2 },
    };

    getEvent.mockResolvedValue(googleEvent());

    const { result } = setup([
      item({ id: "w1", createdAt: 1 }),
      item({ id: "w2", createdAt: 2 }),
    ]);
    await act(() => result.current.syncNow());

    // The older item keeps the event; the copy goes.
    expect(mergedWrite("/work").w2).toBeNull();
    expect(mergedWrite("/links").w2).toBeNull();
    expect(mergedWrite("/work").w1).toBeUndefined();
    // Collapsing a local copy must not take the shared event down with it.
    expect(deleteEvent).not.toHaveBeenCalled();
  });

  it("ignores the surplus copy when one item reached Google twice", async () => {
    config.links = { w1: { eventId: "e1", fingerprint: "x", syncedAt: 1 } };
    const stamped = (id) =>
      googleEvent({
        id,
        extendedProperties: { private: { workflowItemId: "w1" } },
      });
    listEvents.mockResolvedValue({
      events: [stamped("e1"), stamped("e2")],
      nextSyncToken: "tok2",
    });

    const { result } = setup([item()]);
    await act(() => result.current.syncNow());

    // Skipped on the way in rather than removed remotely: this app never
    // deletes from a calendar whose other contents are not its own.
    expect(deleteEvent).not.toHaveBeenCalled();
    // The surplus copy must not come back as another row either.
    expect(mergedWrite("/work").new1).toBeUndefined();
  });

  it("leaves a single event for an item alone", async () => {
    config.links = { w1: { eventId: "e1", fingerprint: "x", syncedAt: 1 } };
    listEvents.mockResolvedValue({
      events: [
        googleEvent({
          id: "e1",
          extendedProperties: { private: { workflowItemId: "w1" } },
        }),
      ],
      nextSyncToken: "tok2",
    });

    const { result } = setup([item()]);
    await act(() => result.current.syncNow());

    expect(deleteEvent).not.toHaveBeenCalled();
  });
});

describe("deletions Google no longer reports still get noticed", () => {
  it("re-lists in full when the last full pass is old", async () => {
    config.syncToken = "tok1";
    config.lastFullSyncAt = Date.now() - 7 * 60 * 60 * 1000;

    const { result } = setup([]);
    await act(() => result.current.syncNow());

    expect(listEvents).toHaveBeenCalledWith(
      "cal1",
      expect.objectContaining({ syncToken: "" })
    );
  });

  it("stays incremental when the last full pass is recent", async () => {
    config.syncToken = "tok1";
    config.lastFullSyncAt = Date.now() - 60 * 1000;

    const { result } = setup([]);
    await act(() => result.current.syncNow());

    expect(listEvents).toHaveBeenCalledWith(
      "cal1",
      expect.objectContaining({ syncToken: "tok1" })
    );
  });

  it("resync drops the token so the next run re-lists everything", async () => {
    config.syncToken = "tok1";
    config.lastFullSyncAt = Date.now();

    const { result } = setup([]);
    await act(() => result.current.resync());

    expect(writesTo("/googleCalendar")[0]).toMatchObject({
      syncToken: "",
      lastFullSyncAt: 0,
    });
  });
});

describe("the calendar is never written away from", () => {
  it("does not delete when an item vanishes from the work list", async () => {
    // The link survives a purge that already removed the item.
    config.links = { gone: { eventId: "e9", fingerprint: "x", syncedAt: 1 } };

    const { result } = setup([]);
    await act(() => result.current.syncNow());

    expect(deleteEvent).not.toHaveBeenCalled();
    // The dangling link is dropped, but the event stays where it is.
    expect(mergedWrite("/links")).toEqual({ gone: null });
  });

  it("leaves repeating series out of the work list entirely", async () => {
    listEvents.mockResolvedValue({
      events: [
        googleEvent({ id: "r1", recurringEventId: "series1" }),
        googleEvent({ id: "r2", recurringEventId: "series1" }),
        googleEvent({ id: "one", summary: "Assembly" }),
      ],
      nextSyncToken: "tok2",
    });

    const { result } = setup([]);
    await act(() => result.current.syncNow());

    // One row for the standalone event, none for the series.
    const written = mergedWrite("/work");
    expect(Object.keys(written)).toHaveLength(1);
    expect(written.new1).toMatchObject({ title: "Assembly", origin: "google" });
  });

  it("asks Google for a bounded window", async () => {
    const { result } = setup([]);
    await act(() => result.current.syncNow());

    const [, params] = listEvents.mock.calls[0];
    expect(params.timeMax).toBeTruthy();
    expect(new Date(params.timeMax).getTime()).toBeGreaterThan(Date.now());
  });
});

describe("reading is all it can do", () => {
  it("pushes nothing to Google, ever", async () => {

    const { result } = setup([item()]);
    await act(() => result.current.syncNow());

    const api = jest.requireActual("./googleCalendar");
    expect(api.insertEvent).toBeUndefined();
    expect(api.patchEvent).toBeUndefined();
    expect(api.deleteEvent).toBeUndefined();
  });

  it("still reads the calendar", async () => {
    listEvents.mockResolvedValue({
      events: [googleEvent({ id: "e5", summary: "Assembly" })],
      nextSyncToken: "tok2",
    });

    const { result } = setup([]);
    await act(() => result.current.syncNow());

    expect(mergedWrite("/work").new1).toMatchObject({ title: "Assembly" });
  });

});
