import React from "react";
import { render, screen } from "@testing-library/react";
import { ref, onValue } from "firebase/database";
import WorkTracker from "./WorkTracker";
import DailyScheduler from "./DailyScheduler";
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
});

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

test("DailyScheduler shows the day's events and due work", () => {
  render(<DailyScheduler user={user} />);
  expect(screen.getByText("Events")).toBeInTheDocument();
  expect(screen.getByText("Activity Fair")).toBeInTheDocument();
  expect(screen.getByText(/Orientation/)).toBeInTheDocument();
});
