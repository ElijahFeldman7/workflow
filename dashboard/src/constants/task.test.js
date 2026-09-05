import { normalizeTask, taskRecord } from "./task";

describe("normalizeTask reads both the old and the new shape", () => {
  test("an old row keeps its text and completed flag", () => {
    expect(normalizeTask("t1", { text: "call the dentist", completed: true })).toMatchObject({
      id: "t1",
      title: "call the dentist",
      done: true,
      when: { mode: "due", date: "", time: "", endTime: "" },
    });
  });

  test("a new row is read directly", () => {
    expect(
      normalizeTask("t2", {
        title: "renew pass",
        done: false,
        priority: "high",
        when: { mode: "event", date: "2026-09-14", time: "15:00", endTime: "16:00" },
      })
    ).toMatchObject({
      title: "renew pass",
      done: false,
      priority: "high",
      when: { mode: "event", date: "2026-09-14", time: "15:00", endTime: "16:00" },
    });
  });

  test("title wins over text when both are present", () => {
    expect(normalizeTask("t3", { title: "new", text: "old" }).title).toBe("new");
  });

  test("done wins over completed when both are present", () => {
    expect(normalizeTask("t4", { done: false, completed: true }).done).toBe(false);
  });

  test("junk is replaced with safe defaults", () => {
    const task = normalizeTask("t5", {
      title: 42,
      priority: "bogus",
      when: { mode: "sideways", date: "nope", time: "99:99", endTime: 7 },
    });
    expect(task).toMatchObject({
      title: "Untitled",
      priority: "medium",
      when: { mode: "due", date: "", time: "", endTime: "" },
    });
  });

  test("a missing row still normalizes", () => {
    expect(normalizeTask("t6", null).title).toBe("Untitled");
    expect(normalizeTask("t7", undefined).done).toBe(false);
  });

  test("tasks carry the fields the shared list expects", () => {
    const task = normalizeTask("t8", { text: "x" });
    expect(task.spaceId).toBe("");
    expect(task.type).toBe("");
    expect(task.location).toBe("");
    expect(typeof task.createdAt).toBe("number");
  });
});

describe("taskRecord builds what gets written", () => {
  test("a parsed capture becomes a storable row", () => {
    expect(
      taskRecord({
        title: "  call the dentist  ",
        priority: "high",
        mode: "event",
        date: "2026-09-14",
        time: "15:00",
        endTime: "16:00",
        location: "room 214",
      })
    ).toMatchObject({
      title: "call the dentist",
      priority: "high",
      location: "room 214",
      done: false,
      completedAt: 0,
      when: { mode: "event", date: "2026-09-14", time: "15:00", endTime: "16:00" },
    });
  });

  test("a due task drops any end time", () => {
    expect(
      taskRecord({ title: "x", priority: "low", mode: "due", date: "2026-09-14", time: "15:00", endTime: "16:00" }).when
    ).toMatchObject({ mode: "due", endTime: "" });
  });

  test("a round trip through both keeps the same values", () => {
    const record = taskRecord({
      title: "renew pass",
      priority: "high",
      mode: "event",
      date: "2026-09-14",
      time: "15:00",
      endTime: "16:00",
      location: "",
    });
    expect(normalizeTask("t9", record)).toMatchObject({
      title: "renew pass",
      priority: "high",
      when: { mode: "event", date: "2026-09-14", time: "15:00", endTime: "16:00" },
    });
  });
});
