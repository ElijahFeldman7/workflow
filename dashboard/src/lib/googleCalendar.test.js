jest.mock("firebase/auth", () => ({
  signInWithPopup: jest.fn(),
  GoogleAuthProvider: class {
    constructor() {
      this.scopes = [];
      this.params = null;
    }
    addScope(scope) {
      this.scopes.push(scope);
    }
    setCustomParameters(params) {
      this.params = params;
    }
    static credentialFromResult = jest.fn();
  },
}));

import { eventToCache, parseIcs } from "./googleCalendar";

describe("parseIcs", () => {
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    "DTSTART;VALUE=DATE:20260909",
    "DTEND;VALUE=DATE:20260910",
    "SUMMARY:Activity Fair",
    "LOCATION:Main gym",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "DTSTART:20260910T143000",
    "DTEND:20260910T153000",
    "SUMMARY:C++ Quiz\\, unit 1",
    "DESCRIPTION:Bring a\\npencil",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  it("reads all-day and timed events", () => {
    const parsed = parseIcs(ics);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({
      title: "Activity Fair",
      location: "Main gym",
      when: { mode: "event", date: "2026-09-09", time: "", endTime: "" },
    });
    expect(parsed[1]).toMatchObject({
      title: "C++ Quiz, unit 1",
      notes: "Bring a\npencil",
      when: { date: "2026-09-10", time: "14:30", endTime: "15:30" },
    });
  });

  it("unfolds wrapped lines", () => {
    const folded = [
      "BEGIN:VEVENT",
      "DTSTART;VALUE=DATE:20260909",
      "SUMMARY:A very long title that the exporter",
      "  wrapped across lines",
      "END:VEVENT",
    ].join("\r\n");
    expect(parseIcs(folded)[0].title).toBe(
      "A very long title that the exporter wrapped across lines"
    );
  });

  it("gives each occurrence an id an import can be matched on", () => {
    const series = [
      "BEGIN:VEVENT",
      "UID:abc@google.com",
      "DTSTART:20260910T143000",
      "SUMMARY:Club",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:abc@google.com",
      "DTSTART:20260917T143000",
      "SUMMARY:Club",
      "END:VEVENT",
    ].join("\r\n");

    expect(parseIcs(series).map((entry) => entry.icsUid)).toEqual([
      "abc@google.com|2026-09-10|14:30",
      "abc@google.com|2026-09-17|14:30",
    ]);
  });

  it("ignores events with no usable start", () => {
    expect(parseIcs("BEGIN:VEVENT\r\nSUMMARY:Nope\r\nEND:VEVENT")).toEqual([]);
  });

  it("returns nothing for text that is not a calendar", () => {
    expect(parseIcs("hello there")).toEqual([]);
  });
});

describe("connecting when the app is not yet verified", () => {
  const { GoogleAuthProvider, signInWithPopup } = require("firebase/auth");
  const {
    CALENDAR_SCOPE,
    GoogleScopeDenied,
    GoogleStaleGrant,
    connect,
    grantedScopes,
    hasToken,
  } = require("./googleCalendar");

  const jsonResponse = (status, body) => ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });

  let provider;

  beforeEach(() => {
    sessionStorage.clear();
    global.fetch = jest.fn();
    signInWithPopup.mockImplementation((authArg, given) => {
      provider = given;
      return Promise.resolve({});
    });
    GoogleAuthProvider.credentialFromResult.mockReturnValue({
      accessToken: "tok",
    });
  });

  it("forces the consent screen so a missed checkbox can be ticked", async () => {
    global.fetch.mockResolvedValue(
      jsonResponse(200, { scope: `openid ${CALENDAR_SCOPE}` })
    );

    await connect();

    expect(provider.params.prompt).toBe("consent");
    expect(provider.scopes).toContain(CALENDAR_SCOPE);
    expect(hasToken()).toBe(true);
  });

  it("does not ask Google to fold in permissions granted before", async () => {
    // That is how a write grant from the two-way days would ride along.
    global.fetch.mockResolvedValue(
      jsonResponse(200, { scope: `openid ${CALENDAR_SCOPE}` })
    );

    await connect();

    expect(provider.params.include_granted_scopes).toBeUndefined();
  });

  it.each([
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
  ])("turns away a token that can still write (%s)", async (writeScope) => {
    global.fetch.mockResolvedValue(
      jsonResponse(200, { scope: `openid ${CALENDAR_SCOPE} ${writeScope}` })
    );

    await expect(connect()).rejects.toBeInstanceOf(GoogleStaleGrant);
    expect(hasToken()).toBe(false);
  });

  it("does not hand one person's token to the next to sign in", async () => {
    const { auth } = require("../firebase");
    global.fetch.mockResolvedValue(
      jsonResponse(200, { scope: `openid ${CALENDAR_SCOPE}` })
    );
    await connect();
    expect(hasToken()).toBe(true);

    const before = auth.currentUser;
    auth.currentUser = { uid: "someone-else" };
    expect(hasToken()).toBe(false);
    auth.currentUser = before;
  });

  it("says so plainly when calendar access was not granted", async () => {
    global.fetch.mockResolvedValue(jsonResponse(200, { scope: "openid email" }));

    await expect(connect()).rejects.toBeInstanceOf(GoogleScopeDenied);
    expect(hasToken()).toBe(false);
  });

  it("connects anyway when the scope check itself cannot be reached", async () => {
    global.fetch.mockRejectedValue(new Error("offline"));
    await expect(connect()).resolves.toBe("tok");
    expect(hasToken()).toBe(true);
  });

  it("reads the scopes off a token", async () => {
    global.fetch.mockResolvedValue(jsonResponse(200, { scope: "a b" }));
    await expect(grantedScopes("tok")).resolves.toEqual(["a", "b"]);

    global.fetch.mockResolvedValue(jsonResponse(400, {}));
    await expect(grantedScopes("tok")).resolves.toBeNull();
  });
});

describe("what the calendar API refuses", () => {
  const {
    GoogleAuthRequired,
    GoogleScopeDenied,
    hasToken,
    listCalendars,
  } = require("./googleCalendar");

  const seedToken = () =>
    sessionStorage.setItem(
      "googleCalendarToken",
      JSON.stringify({ token: "tok", expiresAt: Date.now() + 60_000 })
    );

  const errorResponse = (status, body) => ({
    ok: false,
    status,
    json: () => Promise.resolve(body),
  });

  beforeEach(() => {
    sessionStorage.clear();
    seedToken();
    global.fetch = jest.fn();
  });

  it("treats an expired token as needing a reconnect", async () => {
    global.fetch.mockResolvedValue(errorResponse(401, {}));
    await expect(listCalendars()).rejects.toBeInstanceOf(GoogleAuthRequired);
    expect(hasToken()).toBe(false);
  });

  it("treats a 403 about scope as a missing permission", async () => {
    global.fetch.mockResolvedValue(
      errorResponse(403, {
        error: {
          message: "Request had insufficient authentication scopes.",
          errors: [{ reason: "insufficientPermissions" }],
        },
      })
    );

    await expect(listCalendars()).rejects.toBeInstanceOf(GoogleScopeDenied);
    expect(hasToken()).toBe(false);
  });

  it("keeps the session for a 403 that is not about scope", async () => {
    global.fetch.mockResolvedValue(
      errorResponse(403, {
        error: {
          message: "Rate Limit Exceeded",
          errors: [{ reason: "rateLimitExceeded" }],
        },
      })
    );

    await expect(listCalendars()).rejects.toThrow("Rate Limit Exceeded");
    expect(hasToken()).toBe(true);
  });
});

describe("asking Google for events and calendars", () => {
  const { listCalendars, listEvents } = require("./googleCalendar");

  const params = (call) => new URL(call[0]).searchParams;
  const ok = (body) => ({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  });

  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem(
      "googleCalendarToken",
      JSON.stringify({ token: "tok", expiresAt: Date.now() + 60_000 })
    );
    global.fetch = jest.fn();
  });

  it("asks for single instances inside a window", async () => {
    global.fetch.mockResolvedValue(ok({ items: [] }));

    await listEvents("cal1", {
      timeMin: "2026-01-01T00:00:00.000Z",
      timeMax: "2026-06-01T00:00:00.000Z",
    });

    const query = params(global.fetch.mock.calls[0]);
    expect(query.get("singleEvents")).toBe("true");
    expect(query.get("timeMin")).toBe("2026-01-01T00:00:00.000Z");
    expect(query.get("timeMax")).toBe("2026-06-01T00:00:00.000Z");
  });

  it("follows every page of events", async () => {
    global.fetch
      .mockResolvedValueOnce(ok({ items: [{ id: "a" }], nextPageToken: "p2" }))
      .mockResolvedValueOnce(ok({ items: [{ id: "b" }] }));

    const { events } = await listEvents("cal1", {});

    expect(events.map((event) => event.id)).toEqual(["a", "b"]);
    expect(params(global.fetch.mock.calls[1]).get("pageToken")).toBe("p2");
  });

  it("refuses to read a missing calendar as an empty one", async () => {
    // Answering with no events here is what used to empty the cache.
    global.fetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({}),
    });
    await expect(listEvents("gone", {})).rejects.toThrow(/could not find/i);
  });

  it("lists calendars you can only read, across pages", async () => {
    global.fetch
      .mockResolvedValueOnce(
        ok({
          items: [{ id: "me", summary: "Me", primary: true }],
          nextPageToken: "p2",
        })
      )
      .mockResolvedValueOnce(
        ok({ items: [{ id: "school", summary: "School", accessRole: "reader" }] })
      );

    const calendars = await listCalendars();

    expect(calendars).toEqual([
      { id: "me", name: "Me", primary: true },
      { id: "school", name: "School", primary: false },
    ]);
    expect(params(global.fetch.mock.calls[0]).get("minAccessRole")).toBe(
      "reader"
    );
  });

  it("only ever sends a GET", async () => {
    global.fetch.mockResolvedValue(ok({ items: [] }));
    await listEvents("cal1", {});
    await listCalendars();

    global.fetch.mock.calls.forEach(([, init]) => {
      expect(init.method).toBeUndefined();
      expect(init.body).toBeUndefined();
    });
  });
});

describe("what the cache keeps of an event", () => {
  const event = (overrides = {}) => ({
    id: "e1",
    status: "confirmed",
    summary: "Private Lesson",
    start: { dateTime: "2026-09-09T15:00:00-04:00" },
    end: { dateTime: "2026-09-09T16:00:00-04:00" },
    ...overrides,
  });

  it("keeps the moment, not a clock reading", () => {
    // A clock reading is only right on the device that wrote it.
    expect(eventToCache(event())).toMatchObject({
      title: "Private Lesson",
      start: { dateTime: "2026-09-09T19:00:00.000Z" },
      end: { dateTime: "2026-09-09T20:00:00.000Z" },
    });
  });

  it("keeps an all-day span as its dates", () => {
    const cached = eventToCache(
      event({ start: { date: "2026-09-09" }, end: { date: "2026-09-12" } })
    );
    expect(cached.start).toEqual({ date: "2026-09-09" });
    expect(cached.end).toEqual({ date: "2026-09-12" });
  });

  it("skips cancelled events and ones with no usable start", () => {
    expect(eventToCache(event({ status: "cancelled" }))).toBeNull();
    expect(eventToCache(event({ start: undefined }))).toBeNull();
    expect(eventToCache(event({ start: { dateTime: "nonsense" } }))).toBeNull();
  });

  it("skips an assignment the old sync pushed to Google", () => {
    // The work list still has the original.
    expect(
      eventToCache(
        event({ extendedProperties: { private: { workflowItemId: "w1" } } })
      )
    ).toBeNull();
  });

  it("writes nothing Firebase would reject", () => {
    const cached = eventToCache(event({ end: undefined }));
    expect(Object.values(cached)).not.toContain(undefined);
  });
});

describe("this module cannot change a calendar", () => {
  const api = jest.requireActual("./googleCalendar");

  it("exposes no way to create, change or remove an event", () => {
    // Not guarded, not gated: absent. There is no code path to reach.
    expect(api.insertEvent).toBeUndefined();
    expect(api.patchEvent).toBeUndefined();
    expect(api.deleteEvent).toBeUndefined();
  });

  it("only ever asks Google for read permission", () => {
    // Without the write scope Google refuses a write outright, so this holds
    // even if a future change tries to send one.
    expect(api.CALENDAR_SCOPE).toBe(
      "https://www.googleapis.com/auth/calendar.readonly"
    );
    expect(api.CALENDAR_SCOPE).not.toContain("auth/calendar.events");
  });

  it("exports only read helpers", () => {
    const writeish = Object.keys(api).filter((name) =>
      /insert|patch|delete|update|create|write/i.test(name)
    );
    expect(writeish).toEqual([]);
  });
});
