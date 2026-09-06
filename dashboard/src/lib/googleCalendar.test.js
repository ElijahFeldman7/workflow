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

import {
  eventToItem,
  fingerprint,
  itemToEvent,
  parseIcs,
} from "./googleCalendar";

const item = (overrides = {}) => ({
  id: "a1",
  title: "Activity Fair",
  spaceId: "",
  type: "",
  priority: "medium",
  done: false,
  notes: "",
  location: "",
  when: { mode: "event", date: "2026-09-09", time: "", endTime: "" },
  createdAt: 0,
  completedAt: 0,
  ...overrides,
});

describe("itemToEvent", () => {
  it("writes an undated item as nothing", () => {
    expect(
      itemToEvent(item({ when: { mode: "due", date: "", time: "", endTime: "" } }), "UTC")
    ).toBeNull();
  });

  it("writes a dateless-time item as an all-day event", () => {
    const event = itemToEvent(item(), "America/New_York");
    expect(event.start).toEqual({ date: "2026-09-09" });
    expect(event.end).toEqual({ date: "2026-09-10" });
    expect(event.summary).toBe("Activity Fair");
  });

  it("writes a timed item with the local zone", () => {
    const event = itemToEvent(
      item({
        when: {
          mode: "event",
          date: "2026-09-09",
          time: "15:30",
          endTime: "16:45",
        },
      }),
      "America/New_York"
    );
    expect(event.start).toEqual({
      dateTime: "2026-09-09T15:30:00",
      timeZone: "America/New_York",
    });
    expect(event.end).toEqual({
      dateTime: "2026-09-09T16:45:00",
      timeZone: "America/New_York",
    });
  });

  it("defaults a missing end time to an hour", () => {
    const event = itemToEvent(
      item({
        when: { mode: "event", date: "2026-09-09", time: "23:30", endTime: "" },
      }),
      "UTC"
    );
    expect(event.end.dateTime).toBe("2026-09-10T00:30:00");
  });

  it("rolls an end time before the start onto the next day", () => {
    const event = itemToEvent(
      item({
        when: {
          mode: "event",
          date: "2026-09-09",
          time: "22:00",
          endTime: "01:00",
        },
      }),
      "UTC"
    );
    expect(event.end.dateTime).toBe("2026-09-10T01:00:00");
  });

  it("carries the fields Google has no column for", () => {
    const event = itemToEvent(
      item({ type: "quiz", priority: "insane", done: true, spaceId: "s1" }),
      "UTC"
    );
    expect(event.extendedProperties.private).toMatchObject({
      workflowMode: "event",
      workflowType: "quiz",
      workflowPriority: "insane",
      workflowDone: "1",
      workflowSpaceId: "s1",
    });
  });
});

describe("eventToItem", () => {
  it("reads an all-day event", () => {
    expect(
      eventToItem({ id: "e1", summary: "Orientation", start: { date: "2026-09-11" } })
    ).toMatchObject({
      title: "Orientation",
      when: { mode: "event", date: "2026-09-11", time: "", endTime: "" },
    });
  });

  it("skips an event with no start", () => {
    expect(eventToItem({ id: "e1", summary: "Nothing" })).toBeNull();
  });

  it("restores the fields it wrote out", () => {
    const round = eventToItem(
      itemToEvent(
        item({ type: "test", priority: "high", notes: "chapters 1-3" }),
        "UTC"
      )
    );
    expect(round).toMatchObject({
      title: "Activity Fair",
      notes: "chapters 1-3",
      type: "test",
      priority: "high",
      when: { mode: "event", date: "2026-09-09" },
    });
  });

  it("falls back to defaults for values Google does not carry", () => {
    const mapped = eventToItem({
      id: "e2",
      summary: "Club meeting",
      start: { date: "2026-09-12" },
      extendedProperties: { private: { workflowPriority: "bogus" } },
    });
    expect(mapped.priority).toBe("medium");
    expect(mapped.type).toBe("");
  });
});

describe("fingerprint", () => {
  it("ignores fields that do not travel to Google", () => {
    expect(fingerprint(item({ createdAt: 1 }))).toBe(
      fingerprint(item({ createdAt: 999 }))
    );
  });

  it("changes when a synced field changes", () => {
    expect(fingerprint(item())).not.toBe(fingerprint(item({ title: "Other" })));
  });
});

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

describe("asking Google what changed", () => {
  const {
    SyncTokenExpired,
    getEvent,
    listEvents,
  } = require("./googleCalendar");

  const params = (call) => new URL(call[0]).searchParams;

  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem(
      "googleCalendarToken",
      JSON.stringify({ token: "tok", expiresAt: Date.now() + 60_000 })
    );
    global.fetch = jest.fn();
  });

  it("asks for deleted events, or a deletion can never reach us", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ items: [], nextSyncToken: "tok2" }),
    });

    await listEvents("cal1", { timeMin: "2026-01-01T00:00:00.000Z" });

    const query = params(global.fetch.mock.calls[0]);
    expect(query.get("showDeleted")).toBe("true");
    expect(query.get("singleEvents")).toBe("true");
    expect(query.get("timeMin")).toBe("2026-01-01T00:00:00.000Z");
  });

  it("repeats the same question when following a sync token", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ items: [], nextSyncToken: "tok3" }),
    });

    await listEvents("cal1", {
      syncToken: "tok2",
      timeMin: "2026-01-01T00:00:00.000Z",
    });

    const query = params(global.fetch.mock.calls[0]);
    // Google rejects a sync token whose query differs from the one that made it.
    expect(query.get("singleEvents")).toBe("true");
    expect(query.get("showDeleted")).toBe("true");
    expect(query.get("syncToken")).toBe("tok2");
    expect(query.get("timeMin")).toBeNull();
  });

  it("treats a rejected sync token as a call for a full sync", async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: () =>
        Promise.resolve({
          error: {
            message: "Sync token is no longer valid, a full sync is required.",
          },
        }),
    });

    await expect(listEvents("cal1", { syncToken: "stale" })).rejects.toBeInstanceOf(
      SyncTokenExpired
    );
  });

  it("reports a vanished event as gone rather than as a stale token", async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 410,
      json: () => Promise.resolve({}),
    });
    await expect(getEvent("cal1", "e1")).resolves.toBeNull();

    global.fetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({}),
    });
    await expect(getEvent("cal1", "e1")).resolves.toBeNull();
  });
});
