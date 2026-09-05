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
