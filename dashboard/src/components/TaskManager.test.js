import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ref, onValue, update, push, set, child } from "firebase/database";
import TaskManager from "./TaskManager";
import CalendarView from "./CalendarView";
import { todayKey, addDaysKey } from "../constants/work";

const user = { uid: "u1" };

const TASKS = {
  t1: { text: "call the dentist", completed: false },
  t2: {
    title: "renew bus pass",
    done: false,
    priority: "high",
    when: { mode: "due", date: todayKey(), time: "" },
  },
  t3: {
    title: "orthodontist",
    done: false,
    when: { mode: "event", date: todayKey(), time: "15:00", endTime: "16:00" },
  },
  t4: {
    title: "old chore",
    done: true,
    completedAt: 5,
    when: { mode: "due", date: addDaysKey(todayKey(), -3), time: "" },
  },
  t5: {
    title: "last week social",
    done: false,
    when: { mode: "event", date: addDaysKey(todayKey(), -1), time: "" },
  },
};

const WORK = {
  w1: {
    title: "Cell lab writeup",
    spaceId: "",
    priority: "medium",
    done: false,
    when: { mode: "due", date: todayKey() },
    createdAt: 1,
  },
};

const mockData = (path) => {
  if (path.includes("/tasks")) return TASKS;
  if (path.includes("/work")) return WORK;
  if (path.includes("/spaces")) return null;
  return null;
};

beforeEach(() => {
  ref.mockImplementation((db, path) => ({ toString: () => path }));
  onValue.mockImplementation((reference, callback) => {
    callback({ val: () => mockData(String(reference)) });
    return () => {};
  });
  child.mockImplementation((parent, key) => ({ toString: () => key }));
  update.mockResolvedValue(undefined);
  set.mockResolvedValue(undefined);
  push.mockReturnValue({ key: "new-task", toString: () => "new-task" });
  localStorage.clear();
});

describe("TaskManager", () => {
  test("shows legacy and dated tasks together", () => {
    render(<TaskManager user={user} />);
    expect(screen.getByText("call the dentist")).toBeInTheDocument();
    expect(screen.getByText("renew bus pass")).toBeInTheDocument();
    expect(screen.getByText("orthodontist")).toBeInTheDocument();
  });

  test("groups by the same buckets the work list uses", () => {
    render(<TaskManager user={user} />);
    const row = screen.getByText("renew bus pass").closest("li");
    expect(row.closest("ul").previousSibling.textContent).toBe("Today");
    expect(screen.getByText("No date")).toBeInTheDocument();
  });

  test("a past task is hidden until the setting is on", () => {
    const { unmount } = render(<TaskManager user={user} />);
    expect(screen.queryByText("last week social")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Past/ })).not.toBeInTheDocument();
    unmount();

    localStorage.setItem("workPrefs", JSON.stringify({ showPast: true }));
    render(<TaskManager user={user} />);
    fireEvent.click(screen.getByRole("button", { name: /Past/ }));
    expect(screen.getByText("last week social")).toBeInTheDocument();
  });

  test("a completed task moves to Done regardless of its date", () => {
    render(<TaskManager user={user} />);
    const row = screen.getByText("old chore").closest("li");
    expect(row.closest("ul").previousSibling.textContent).toBe("Done");
  });

  test("ticking a task writes done and completedAt", () => {
    render(<TaskManager user={user} />);
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Mark call the dentist as done/i })
    );
    expect(update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ done: true })
    );
  });

  test("a task can be renamed in place", () => {
    render(<TaskManager user={user} />);
    fireEvent.click(screen.getByText("call the dentist"));
    const input = screen.getByLabelText("Title");
    fireEvent.change(input, { target: { value: "call the orthodontist" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(update).toHaveBeenCalledWith(expect.anything(), {
      title: "call the orthodontist",
    });
  });

  test("a task can be given a date without leaving the row", () => {
    render(<TaskManager user={user} />);
    const row = screen.getByText("call the dentist").closest("li");
    fireEvent.click(within(row).getByTitle("Click to change the date"));
    fireEvent.change(within(row).getByLabelText(/Date for call the dentist/i), {
      target: { value: "2026-12-25" },
    });
    expect(update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        when: expect.objectContaining({ date: "2026-12-25" }),
      })
    );
  });

  test("the quick add bar parses a typed task into fields", () => {
    render(<TaskManager user={user} />);
    const input = screen.getByLabelText("Quick add");
    fireEvent.change(input, { target: { value: "call the dentist tomorrow 3pm" } });

    expect(screen.getByText("Tomorrow, 3:00 PM")).toBeInTheDocument();

    fireEvent.keyDown(input, { key: "Enter" });
    expect(set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        title: "call the dentist",
        when: expect.objectContaining({ time: "15:00" }),
      })
    );
  });

  test("tasks have no class or type controls, since they have neither", () => {
    render(<TaskManager user={user} />);
    fireEvent.click(screen.getByRole("button", { name: /Edit call the dentist/i }));
    expect(screen.getByLabelText("Class")).toBeInTheDocument();
    expect(screen.getByLabelText("Class").options).toHaveLength(1);
  });
});

describe("the calendar aggregates tasks alongside work", () => {
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
