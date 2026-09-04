import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ref, onValue, update, child } from "firebase/database";
import WorkTracker from "./WorkTracker";
import CalendarView from "./CalendarView";
import { todayKey, addDaysKey } from "../constants/work";

const user = { uid: "u1" };

const SPACES = {
  s1: { name: "AP Bio", kind: "class", color: "emerald", createdAt: 1 },
  s2: { name: "Computer Team", kind: "club", color: "violet", createdAt: 2 },
};

const WORK = {
  w1: {
    title: "Cell lab writeup",
    spaceId: "s1",
    type: "lab",
    priority: "insane",
    done: false,
    when: { mode: "due", date: addDaysKey(todayKey(), -2) },
    createdAt: 1,
  },
  w2: {
    title: "Activity Fair",
    spaceId: "s2",
    type: "other",
    priority: "medium",
    done: false,
    location: "Gym",
    when: { mode: "event", date: todayKey(), time: "15:00", endTime: "17:00" },
    createdAt: 2,
  },
  w3: {
    title: "Orientation",
    spaceId: "s2",
    type: "seminar",
    priority: "high",
    done: false,
    when: { mode: "event", date: todayKey() },
    createdAt: 3,
  },
  w4: { title: "junk row with no fields" },
};

const mockData = (path) => {
  if (path.includes("/spaces")) return SPACES;
  if (path.includes("/work")) return WORK;
  return null;
};

beforeEach(() => {
  // CRA's jest config sets resetMocks, so setupTests' implementations are gone.
  ref.mockImplementation((db, path) => ({ toString: () => path }));
  onValue.mockImplementation((reference, callback) => {
    callback({ val: () => mockData(String(reference)) });
    return () => {};
  });
  child.mockImplementation((parent, key) => ({ toString: () => key }));
  update.mockResolvedValue(undefined);
});

// The group a row is rendered under, found by walking up to the group wrapper.
const groupOf = (title) => {
  const row = screen.getByText(title).closest("li");
  const list = row.closest("ul");
  return list.previousSibling.textContent;
};

test("WorkTracker renders items grouped and color-coded", () => {
  render(<WorkTracker user={user} />);
  expect(screen.getByText("Overdue")).toBeInTheDocument(); // group heading
  expect(screen.getByText("Cell lab writeup")).toBeInTheDocument();
  expect(screen.getByText("Activity Fair")).toBeInTheDocument();
  // Row with no class, type, priority or date falls back to defaults.
  expect(screen.getByText("junk row with no fields")).toBeInTheDocument();
  // Group heading plus the row's own date cell.
  expect(screen.getAllByText("No date").length).toBeGreaterThan(0);
});

test("ticking an item moves it to Done without waiting on the server", () => {
  render(<WorkTracker user={user} />);
  expect(groupOf("Cell lab writeup")).toBe("Overdue");

  fireEvent.click(
    screen.getByRole("checkbox", { name: /Mark Cell lab writeup as done/i })
  );

  expect(update).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ done: true })
  );
  // Moved and struck through straight away — the Firebase mock never echoes
  // the write back, so this can only come from the optimistic state.
  expect(groupOf("Cell lab writeup")).toBe("Done");
  expect(screen.getByText("Cell lab writeup").className).toMatch("line-through");
});

test("the details strip writes just the field you touched", () => {
  render(<WorkTracker user={user} />);

  fireEvent.click(
    screen.getByRole("button", { name: /Edit Cell lab writeup/i })
  );

  fireEvent.change(screen.getByLabelText("Type"), { target: { value: "quiz" } });
  expect(update).toHaveBeenCalledWith(expect.anything(), { type: "quiz" });

  fireEvent.change(screen.getByLabelText("Priority"), {
    target: { value: "low" },
  });
  expect(update).toHaveBeenCalledWith(expect.anything(), { priority: "low" });
});

test("renaming a row commits on Enter", () => {
  render(<WorkTracker user={user} />);

  fireEvent.click(screen.getByText("Cell lab writeup"));
  const input = screen.getByLabelText("Title");
  fireEvent.change(input, { target: { value: "Cell lab v2" } });
  fireEvent.keyDown(input, { key: "Enter" });

  expect(update).toHaveBeenCalledWith(expect.anything(), {
    title: "Cell lab v2",
  });
});

test("clicking a row's pill filters by it, clicking again clears it", () => {
  render(<WorkTracker user={user} />);
  expect(screen.getByText("Activity Fair")).toBeInTheDocument();

  // INSANE only matches the lab writeup.
  fireEvent.click(screen.getByRole("button", { name: "INSANE" }));
  expect(screen.getByText("Cell lab writeup")).toBeInTheDocument();
  expect(screen.queryByText("Activity Fair")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "INSANE" }));
  expect(screen.getByText("Activity Fair")).toBeInTheDocument();
});

test("the filter panel is behind an icon and offers only what matches", () => {
  render(<WorkTracker user={user} />);

  // Collapsed by default — no headings on the page.
  expect(screen.queryByText("Priority")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Filters" }));
  const panel = screen.getByText("Priority").closest("div").parentElement;

  expect(within(panel).getByText("Class")).toBeInTheDocument();
  expect(within(panel).getByText("Type")).toBeInTheDocument();
  // "Lab" is in use; "Final" is not, so it never appears as a chip.
  expect(within(panel).getByRole("button", { name: "Lab" })).toBeInTheDocument();
  expect(
    within(panel).queryByRole("button", { name: "Final" })
  ).not.toBeInTheDocument();

  fireEvent.click(within(panel).getByRole("button", { name: "INSANE" }));
  expect(screen.queryByText("Activity Fair")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "clear filters" }));
  expect(screen.getByText("Activity Fair")).toBeInTheDocument();
});

test("details strip exposes notes without a modal", () => {
  render(<WorkTracker user={user} />);

  fireEvent.click(
    screen.getByRole("button", { name: /Edit Cell lab writeup/i })
  );

  const notes = screen.getByLabelText("Notes");
  fireEvent.change(notes, { target: { value: "check the rubric" } });
  expect(update).toHaveBeenCalledWith(expect.anything(), {
    notes: "check the rubric",
  });
});

test("the calendar's day panel can add, edit and delete", () => {
  render(<CalendarView user={user} />);

  // Adding defaults to the selected day rather than needing a date typed in.
  expect(screen.getByPlaceholderText(/Add to today/i)).toBeInTheDocument();

  // Same pencil and bin as the work list.
  fireEvent.click(screen.getByRole("button", { name: /Edit Activity Fair/i }));
  fireEvent.change(screen.getByLabelText("Priority"), {
    target: { value: "high" },
  });
  expect(update).toHaveBeenCalledWith(expect.anything(), { priority: "high" });

  expect(
    screen.getByRole("button", { name: /Delete Activity Fair/i })
  ).toBeInTheDocument();

  // Both of today's items are events, which have no done state to tick.
  expect(
    screen.queryByRole("checkbox", { name: /Activity Fair/i })
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("checkbox", { name: /Orientation/i })
  ).not.toBeInTheDocument();
});

test("calendar chips tick off deadlines and open events", () => {
  render(<CalendarView user={user} />);

  // A deadline in a month cell gets its own checkbox.
  fireEvent.click(
    screen.getByRole("checkbox", { name: /Mark Cell lab writeup as done/i })
  );
  expect(update).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ done: true })
  );

  // Events are moments with no done state, so they get no checkbox...
  expect(
    screen.queryByRole("checkbox", { name: /Mark Activity Fair/i })
  ).not.toBeInTheDocument();

  // ...but the label still opens the day, which is where editing happens.
  const chip = screen.getAllByRole("button", { name: /Open Activity Fair/i })[0];
  expect(chip).toBeInTheDocument();
  fireEvent.click(chip);
  expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();
});

test("the calendar follows the table setting like the work list", () => {
  localStorage.setItem("workPrefs", JSON.stringify({ table: true }));
  render(<CalendarView user={user} />);

  // Column headers only exist in the table renderer.
  expect(screen.getByRole("columnheader", { name: "Name" })).toBeInTheDocument();
  expect(screen.getByRole("columnheader", { name: "Priority" })).toBeInTheDocument();

  localStorage.clear();
});

test("the week view splits deadlines from timed blocks", () => {
  localStorage.setItem("workPrefs", JSON.stringify({ calendarView: "week" }));
  render(<CalendarView user={user} />);

  // Deadlines are moments, so they sit in the all-day row rather than the grid.
  expect(screen.getByText("all day")).toBeInTheDocument();

  // The hour window fits the 3-5pm event.
  expect(screen.getByText("3 PM")).toBeInTheDocument();
  expect(screen.getByText("5 PM")).toBeInTheDocument();

  // Activity Fair is timed, so it renders as a positioned block with a height.
  const block = screen
    .getAllByTitle(/Activity Fair/)
    .find((node) => node.tagName === "BUTTON");
  expect(block).toBeTruthy();
  expect(block.style.height).not.toBe("");

  localStorage.clear();
});

test("every week row scrolls together so the columns stay aligned", () => {
  localStorage.setItem("workPrefs", JSON.stringify({ calendarView: "week" }));
  const { container } = render(<CalendarView user={user} />);

  // A scrollbar on the timed area alone would make its columns narrower than
  // the header rows above it. One scroller around all of them can't drift.
  const scrollers = container.querySelectorAll(".overflow-y-auto");
  expect(scrollers).toHaveLength(1);

  const scroller = scrollers[0];
  const rows = scroller.querySelectorAll(":scope > * > .grid, :scope > .grid");
  expect(rows.length).toBe(3); // day headers, all day, timed

  rows.forEach((row) =>
    expect(row.className).toContain("grid-cols-[3.25rem_repeat(7,minmax(0,1fr))]")
  );

  localStorage.clear();
});

test("the calendar renders a month grid of the same work items", () => {
  render(<CalendarView user={user} />);

  // Weekday headers prove the grid rendered.
  expect(screen.getByText("Sun")).toBeInTheDocument();
  expect(screen.getByText("Sat")).toBeInTheDocument();

  // Today is selected on mount, so its items are listed under the grid.
  expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();
  expect(screen.getAllByText("Activity Fair").length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Orientation/).length).toBeGreaterThan(0);
});
