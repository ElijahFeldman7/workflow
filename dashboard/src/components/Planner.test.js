import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ref, onValue, update, push, set, remove, child } from "firebase/database";
import Planner from "./Planner";
import CalendarView from "./CalendarView";
import { todayKey, addDaysKey } from "../constants/work";
import { weekMatrix } from "../lib/calendar";

jest.mock("../lib/googleCalendar", () => ({
  ...jest.requireActual("../lib/googleCalendar"),
  hasToken: jest.fn(() => false),
}));

const user = { uid: "u1" };
const today = todayKey();

const at = (hour) => {
  const moment = new Date();
  moment.setHours(hour, 0, 0, 0);
  return moment.toISOString();
};

const BASE_TASKS = {
  t1: { text: "call the dentist", completed: false },
  t2: {
    title: "renew bus pass",
    done: false,
    priority: "high",
    when: { mode: "due", date: today, time: "" },
  },
  t3: {
    title: "orthodontist",
    done: false,
    when: { mode: "event", date: today, time: "15:00", endTime: "16:00" },
  },
  t6: { title: "laundry", done: false, plan: { date: today }, createdAt: 1 },
  t7: {
    title: "study calc",
    done: false,
    plan: { date: today, time: "16:00", minutes: 60 },
    createdAt: 2,
  },
  t8: {
    title: "clean desk",
    done: false,
    plan: { date: addDaysKey(today, -1) },
  },
};

const WORK = {
  w1: {
    title: "Cell lab writeup",
    spaceId: "",
    priority: "medium",
    done: false,
    when: { mode: "due", date: addDaysKey(today, 3) },
    createdAt: 1,
  },
};

const GOOGLE = {
  g1: {
    title: "Assembly",
    start: { dateTime: at(10) },
    end: { dateTime: at(11) },
  },
};

let tasks;
let repeats;

const mockData = (path) => {
  if (path.includes("/tasks")) return tasks;
  if (path.includes("/work")) return WORK;
  if (path.includes("/googleEvents")) return GOOGLE;
  if (path.includes("/repeats")) return repeats;
  return null;
};

// jsdom has no DragEvent, and without one a drop carries no position.
beforeAll(() => {
  if (!window.DragEvent) window.DragEvent = class extends MouseEvent {};
});

beforeEach(() => {
  tasks = BASE_TASKS;
  repeats = null;
  ref.mockImplementation((db, path) => ({ toString: () => path || "" }));
  onValue.mockImplementation((reference, callback) => {
    callback({ val: () => mockData(String(reference)) });
    return () => {};
  });
  child.mockImplementation((parent, key) => ({ toString: () => key }));
  update.mockResolvedValue(undefined);
  set.mockResolvedValue(undefined);
  remove.mockResolvedValue(undefined);
  push.mockReturnValue({ key: "new-task", toString: () => "new-task" });
  localStorage.clear();
});

const writesTo = (id) =>
  update.mock.calls
    .filter(([target]) => String(target) === id)
    .map(([, payload]) => payload);

const tray = () => screen.getByRole("region", { name: "Planned for the day" });
const timeline = () => screen.getByRole("region", { name: "Day timeline" });
const backlog = () => screen.getByRole("region", { name: "Backlog" });

describe("a day in the planner", () => {
  test("shows what is planned, what is fixed, and what is still to plan", () => {
    render(<Planner user={user} />);

    expect(within(tray()).getByText("laundry")).toBeInTheDocument();
    expect(within(timeline()).getByText("study calc")).toBeInTheDocument();
    expect(within(timeline()).getByText("orthodontist")).toBeInTheDocument();
    expect(within(timeline()).getByText("Assembly")).toBeInTheDocument();

    const list = within(backlog());
    expect(list.getByText("Due today")).toBeInTheDocument();
    expect(list.getByText("renew bus pass")).toBeInTheDocument();
    expect(list.getByText("Cell lab writeup")).toBeInTheDocument();
    expect(list.getByText("call the dentist")).toBeInTheDocument();
    // On the day already, so not offered again.
    expect(list.queryByText("laundry")).not.toBeInTheDocument();
  });

  test("Google's events can be seen and nothing else", () => {
    render(<Planner user={user} />);
    const block = within(timeline()).getByText("Assembly").parentElement;

    expect(block.getAttribute("draggable")).toBeNull();
    expect(within(block).queryByRole("checkbox")).not.toBeInTheDocument();
    expect(within(block).queryByRole("button")).not.toBeInTheDocument();

    fireEvent.click(block);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("a typed to-do belongs to the day it was typed on", () => {
    render(<Planner user={user} />);
    const input = screen.getByLabelText("Quick add");
    fireEvent.change(input, { target: { value: "change sheets" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        title: "change sheets",
        when: expect.objectContaining({ date: "" }),
        plan: { date: today, time: "", minutes: 0 },
      })
    );
  });

  test("a time typed with no date is when to do it, not when it is due", () => {
    render(<Planner user={user} />);
    const input = screen.getByLabelText("Quick add");
    fireEvent.change(input, { target: { value: "laundry 3pm" } });
    fireEvent.keyDown(input, { key: "Enter" });

    const [, record] = set.mock.calls[0];
    if (record.when.mode === "event") {
      expect(record.when).toMatchObject({ date: today, time: "15:00" });
    } else {
      expect(record.when.time).toBe("");
      expect(record.plan).toMatchObject({ date: today, time: "15:00" });
    }
  });

  test("work due later can be pulled onto today without moving its due date", () => {
    render(<Planner user={user} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Plan Cell lab writeup for today" })
    );

    expect(writesTo("w1")).toEqual([
      { plan: { date: today, time: "", minutes: 0 } },
    ]);
  });

  test("ticking something planned writes to the list it came from", () => {
    render(<Planner user={user} />);
    fireEvent.click(
      within(tray()).getByRole("checkbox", { name: "Mark laundry as done" })
    );
    expect(writesTo("t6")).toEqual([
      expect.objectContaining({ done: true }),
    ]);
  });
});

describe("dragging", () => {
  test("dropping on the timeline gives a time and a length", () => {
    render(<Planner user={user} />);
    const row = within(backlog()).getByText("Cell lab writeup").closest("li");

    fireEvent.dragStart(row);
    // The grid starts at 7 AM, 10px down, at 0.9px a minute.
    fireEvent.drop(screen.getByTestId("day-column"), {
      clientY: 10 + 3 * 60 * 0.9,
    });

    expect(writesTo("w1")).toEqual([
      { plan: { date: today, time: "10:00", minutes: 30 } },
    ]);
  });

  test("shows where it would land before it is let go", () => {
    render(<Planner user={user} />);
    const column = screen.getByTestId("day-column");
    const row = within(backlog()).getByText("Cell lab writeup").closest("li");

    expect(screen.queryByTestId("landing")).not.toBeInTheDocument();

    fireEvent.dragStart(row);
    fireEvent.dragOver(column, { clientY: 10 + 3 * 60 * 0.9 });
    expect(screen.getByTestId("landing")).toHaveTextContent(
      "10:00 AM–10:30 AM"
    );

    // It follows the pointer, a quarter hour at a time.
    fireEvent.dragOver(column, { clientY: 10 + 4 * 60 * 0.9 + 5 });
    expect(screen.getByTestId("landing")).toHaveTextContent(
      "11:00 AM–11:30 AM"
    );

    fireEvent.drop(column, { clientY: 10 + 4 * 60 * 0.9 + 5 });
    expect(screen.queryByTestId("landing")).not.toBeInTheDocument();
    expect(writesTo("w1")).toEqual([
      { plan: { date: today, time: "11:00", minutes: 30 } },
    ]);
  });

  test("the landing mark goes when the drag leaves or is given up", () => {
    render(<Planner user={user} />);
    const column = screen.getByTestId("day-column");
    const row = within(backlog()).getByText("Cell lab writeup").closest("li");

    fireEvent.dragStart(row);
    fireEvent.dragOver(column, { clientY: 200 });
    fireEvent.dragLeave(column);
    expect(screen.queryByTestId("landing")).not.toBeInTheDocument();

    fireEvent.dragOver(column, { clientY: 200 });
    fireEvent.dragEnd(row);
    expect(screen.queryByTestId("landing")).not.toBeInTheDocument();
  });

  test("dropping a block back in the day's list takes its time away", () => {
    render(<Planner user={user} />);
    const block = within(timeline()).getByText("study calc").closest("[draggable]");

    fireEvent.dragStart(block);
    fireEvent.drop(tray());

    expect(writesTo("t7")).toEqual([
      { plan: { date: today, time: "", minutes: 60 } },
    ]);
  });

  test("dropping on the backlog takes it off the day", () => {
    render(<Planner user={user} />);
    fireEvent.dragStart(within(tray()).getByText("laundry").closest("li"));
    fireEvent.drop(backlog());

    expect(writesTo("t6")).toEqual([{ plan: null }]);
  });

  test("pulling the bottom edge changes how long it takes", () => {
    render(<Planner user={user} />);
    fireEvent.mouseDown(
      screen.getByRole("separator", { name: /length of study calc/ }),
      { clientY: 100 }
    );
    fireEvent.mouseMove(window, { clientY: 100 + 30 * 0.9 });
    fireEvent.mouseUp(window);

    expect(writesTo("t7")).toEqual([
      { plan: { date: today, time: "16:00", minutes: 90 } },
    ]);
  });
});

describe("planning by tapping", () => {
  test("a start time and a length can be set without dragging", () => {
    render(<Planner user={user} />);
    fireEvent.click(screen.getByRole("button", { name: "Open laundry" }));
    const menu = within(screen.getByRole("dialog"));

    fireEvent.change(menu.getByLabelText("Start time"), {
      target: { value: "14:00" },
    });
    fireEvent.click(menu.getByRole("button", { name: "60 minutes" }));

    expect(writesTo("t6")).toEqual([
      { plan: { date: today, time: "14:00", minutes: 30 } },
      { plan: { date: today, time: "", minutes: 60 } },
    ]);
  });

  test("something in the backlog can be sent to tomorrow", () => {
    render(<Planner user={user} />);
    fireEvent.click(screen.getByRole("button", { name: "Open call the dentist" }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Tomorrow" })
    );

    expect(writesTo("t1")).toEqual([
      { plan: { date: addDaysKey(today, 1), time: "", minutes: 0 } },
    ]);
  });

  test("work cannot be deleted or repeated from here", () => {
    render(<Planner user={user} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Open Cell lab writeup" })
    );
    const menu = within(screen.getByRole("dialog"));

    expect(menu.queryByRole("button", { name: /Delete/ })).not.toBeInTheDocument();
    expect(menu.queryByRole("button", { name: /Repeat on/ })).not.toBeInTheDocument();
  });
});

describe("what was not finished", () => {
  test("is offered, not moved", () => {
    render(<Planner user={user} />);
    const banner = within(
      screen.getByRole("region", { name: "Unfinished from earlier" })
    );

    expect(banner.getByText(/1 unfinished from earlier/)).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
  });

  test("can be moved to today or dropped", () => {
    render(<Planner user={user} />);
    const banner = within(
      screen.getByRole("region", { name: "Unfinished from earlier" })
    );

    fireEvent.click(banner.getByRole("button", { name: "Move all to today" }));
    fireEvent.click(banner.getByRole("button", { name: "Drop all" }));

    expect(writesTo("t8")).toEqual([
      { plan: { date: today, time: "", minutes: 0 } },
      { plan: null },
    ]);
  });
});

describe("to-dos that repeat", () => {
  const everyDay = {
    r1: { title: "change sheets", weekdays: [0, 1, 2, 3, 4, 5, 6] },
  };
  const madeKey = `rep_r1_${today}`;

  test("one is made for the day, once", () => {
    repeats = everyDay;
    const { rerender } = render(<Planner user={user} />);
    rerender(<Planner user={user} />);

    const made = writesTo("users/u1/tasks");
    expect(made).toHaveLength(1);
    expect(made[0][madeKey]).toMatchObject({
      title: "change sheets",
      repeatId: "r1",
      plan: { date: today },
    });
  });

  test("one that exists is never written over", () => {
    repeats = everyDay;
    tasks = {
      ...BASE_TASKS,
      [madeKey]: {
        title: "change sheets",
        done: true,
        repeatId: "r1",
        plan: { date: today },
      },
    };
    render(<Planner user={user} />);

    expect(writesTo("users/u1/tasks")).toEqual([]);
  });

  test("deleting one hides it, so the repeat does not bring it back", () => {
    repeats = everyDay;
    tasks = {
      ...BASE_TASKS,
      [madeKey]: {
        title: "change sheets",
        done: false,
        repeatId: "r1",
        plan: { date: today },
      },
    };
    render(<Planner user={user} />);

    fireEvent.click(screen.getByRole("button", { name: "Open change sheets" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete change sheets" }));

    expect(writesTo(madeKey)).toEqual([{ skipped: true }]);
    expect(remove).not.toHaveBeenCalled();
  });

  test("a hidden one stays hidden", () => {
    repeats = everyDay;
    tasks = {
      ...BASE_TASKS,
      [madeKey]: {
        title: "change sheets",
        skipped: true,
        repeatId: "r1",
        plan: { date: today },
      },
    };
    render(<Planner user={user} />);

    expect(screen.queryByText("change sheets")).not.toBeInTheDocument();
    expect(writesTo("users/u1/tasks")).toEqual([]);
  });

  test("a to-do can be made to repeat", async () => {
    push.mockReturnValue({ key: "r9", toString: () => "users/u1/repeats/r9" });
    render(<Planner user={user} />);

    fireEvent.click(screen.getByRole("button", { name: "Open laundry" }));
    fireEvent.click(screen.getByRole("button", { name: "Repeat on Sun" }));

    expect(set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        title: "laundry",
        weekdays: [0],
        from: addDaysKey(today, 1),
      })
    );
    await screen.findByRole("dialog");
    expect(writesTo("users/u1/tasks/t6")).toEqual([{ repeatId: "r9" }]);
  });
});

describe("the week at once", () => {
  beforeEach(() => {
    localStorage.setItem("workPrefs", JSON.stringify({ plannerView: "week" }));
  });

  test("shows each day's plan and moves it between days", () => {
    render(<Planner user={user} />);
    const days = weekMatrix(today);
    const other = days.find((day) => day.key !== today);
    const column = (day) =>
      screen.getByRole("region", { name: `${day.weekday} ${day.dayOfMonth}` });
    const todayColumn = column(days.find((day) => day.key === today));

    expect(within(todayColumn).getByText("laundry")).toBeInTheDocument();
    expect(within(todayColumn).getByText("Assembly")).toBeInTheDocument();

    fireEvent.dragStart(
      within(todayColumn).getByText("laundry").closest("[draggable]")
    );
    fireEvent.drop(column(other));

    expect(writesTo("t6")).toEqual([
      { plan: { date: other.key, time: "", minutes: 0 } },
    ]);
  });
});

describe("the calendar aggregates tasks alongside work", () => {
  const WORK_TODAY = {
    w1: { ...WORK.w1, when: { mode: "due", date: today } },
  };

  beforeEach(() => {
    onValue.mockImplementation((reference, callback) => {
      const path = String(reference);
      callback({
        val: () =>
          path.includes("/tasks")
            ? BASE_TASKS
            : path.includes("/work")
            ? WORK_TODAY
            : null,
      });
      return () => {};
    });
  });

  test("both sources appear on the same day", () => {
    render(<CalendarView user={user} />);
    expect(screen.getAllByText("Cell lab writeup").length).toBeGreaterThan(0);
    expect(screen.getAllByText("renew bus pass").length).toBeGreaterThan(0);
  });

  test("either source can be switched off", () => {
    render(<CalendarView user={user} />);
    fireEvent.click(screen.getByRole("button", { name: "Tasks" }));
    expect(screen.queryByText("renew bus pass")).not.toBeInTheDocument();
    expect(screen.getAllByText("Cell lab writeup").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Work" }));
    expect(screen.queryByText("Cell lab writeup")).not.toBeInTheDocument();
  });

  test("a timed task lays out as a block in the week view", () => {
    localStorage.setItem("workPrefs", JSON.stringify({ calendarView: "week" }));
    render(<CalendarView user={user} />);
    const block = screen
      .getAllByTitle(/orthodontist/)
      .find((node) => node.tagName === "BUTTON");
    expect(block).toBeTruthy();
    expect(block.style.height).not.toBe("");
  });

  test("ticking a task from the calendar writes to the tasks path", () => {
    render(<CalendarView user={user} />);
    fireEvent.click(
      screen.getAllByRole("checkbox", { name: /Mark renew bus pass as done/i })[0]
    );
    expect(child).toHaveBeenCalledWith(expect.anything(), "t2");
    expect(update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ done: true })
    );
  });
});
