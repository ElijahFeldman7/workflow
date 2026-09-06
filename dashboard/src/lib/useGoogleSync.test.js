import { renderHook, act } from "@testing-library/react";
import { ref, get, update, push } from "firebase/database";
import { useGoogleSync } from "./useGoogleSync";
import {
  getEvent,
  insertEvent,
  listEvents,
  patchEvent,
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
  insertEvent: jest.fn(),
  itemToEvent: jest.requireActual("./googleCalendar").itemToEvent,
  listCalendars: jest.fn(() => Promise.resolve([])),
  listEvents: jest.fn(),
  localTimeZone: () => "UTC",
  patchEvent: jest.fn(() => Promise.resolve({})),
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
  patchEvent.mockResolvedValue({});
  getEvent.mockResolvedValue(null);
  insertEvent.mockResolvedValue({ id: "inserted1" });
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
    expect(insertEvent).not.toHaveBeenCalled();
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

describe("events are never inserted twice", () => {
  it("keeps the links of events it already created when the sync then fails", async () => {
    config.links = {};
    insertEvent
      .mockResolvedValueOnce({ id: "inserted1" })
      .mockRejectedValueOnce(new Error("network died"));

    const { result } = setup([item({ id: "w1" }), item({ id: "w2" })]);
    await act(() => result.current.syncNow());

    // The first event exists in Google, so its link has to survive the failure.
    expect(mergedWrite("/links").w1).toMatchObject({ eventId: "inserted1" });
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
    expect(insertEvent).not.toHaveBeenCalled();
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
    expect(insertEvent).not.toHaveBeenCalled();
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
