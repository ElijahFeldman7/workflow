import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { update } from "firebase/database";
import { database } from "../firebase";
import FocusTimer from "./FocusTimer";

const user = { uid: "u1" };
const NOW = 1_700_000_000_000;

// CRA resets mock implementations between tests, so re-arm the ones we need.
const mountWith = (saved) => {
  database.ref.mockImplementation((path) => ({ path }));
  database.onValue.mockImplementation((reference, callback) => {
    callback({ val: () => saved });
    return () => {};
  });
  return render(<FocusTimer user={user} />);
};

const lastWrite = () => update.mock.calls[update.mock.calls.length - 1][1];

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Date, "now").mockReturnValue(NOW);
  jest.spyOn(window.HTMLMediaElement.prototype, "play").mockResolvedValue();
});

afterEach(() => {
  Date.now.mockRestore();
});

describe("the session survives a reload", () => {
  it("picks a running clock back up where real time left it", () => {
    mountWith({
      mode: "work",
      remaining: 300,
      running: true,
      startedAt: NOW - 60_000,
      updatedAt: 1,
    });

    expect(screen.getByText("04:00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
  });

  it("restores the durations the user chose", () => {
    mountWith({
      mode: "work",
      remaining: 50 * 60,
      workDuration: 50,
      breakDuration: 10,
      updatedAt: 1,
    });

    expect(screen.getByText("50:00")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Open settings M10.325"));
    expect(screen.getByLabelText("Work (min)")).toHaveValue(50);
    expect(screen.getByLabelText("Break (min)")).toHaveValue(10);
  });

  it("restores which side of the pomodoro it is on", () => {
    mountWith({ mode: "break", remaining: 5 * 60, updatedAt: 1 });
    expect(screen.getByText("be chill")).toBeInTheDocument();
  });

  it("shows time already studied, including the running stretch", () => {
    mountWith({
      remaining: 300,
      running: true,
      startedAt: NOW - 120_000,
      stats: { work: 3600, break: 0 },
      updatedAt: 1,
    });

    fireEvent.click(screen.getByLabelText("Open settings M10.325"));
    expect(screen.getByText("1h 2m")).toBeInTheDocument();
  });

  it("finishes a session that ran out while the tab was closed", () => {
    mountWith({
      remaining: 60,
      running: true,
      startedAt: NOW - 8 * 3600 * 1000,
      stats: { work: 0, break: 0 },
      updatedAt: 1,
    });

    // The interval is over, so it rolls on to the break rather than hanging.
    expect(screen.getByText("be chill")).toBeInTheDocument();
    expect(screen.getByText("05:00")).toBeInTheDocument();

    // ...and books only the minute that was genuinely left, not eight hours.
    fireEvent.click(screen.getByLabelText("Open settings M10.325"));
    expect(screen.getByText("0h 1m")).toBeInTheDocument();
  });
});

describe("every change is written down", () => {
  it("anchors the clock on start", () => {
    mountWith({ remaining: 300, updatedAt: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Start" }));

    expect(lastWrite()).toMatchObject({
      running: true,
      startedAt: NOW,
      remaining: 300,
    });
  });

  it("banks the elapsed time on pause", () => {
    mountWith({
      remaining: 300,
      running: true,
      startedAt: NOW - 90_000,
      stats: { work: 10, break: 0 },
      updatedAt: 1,
    });

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));

    expect(lastWrite()).toMatchObject({
      running: false,
      startedAt: 0,
      remaining: 210,
      stats: { work: 100, break: 0 },
    });
  });

  it("keeps the studied time when the clock is reset", () => {
    mountWith({
      remaining: 300,
      running: true,
      startedAt: NOW - 60_000,
      stats: { work: 0, break: 0 },
      workDuration: 25,
      updatedAt: 1,
    });

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    expect(lastWrite()).toMatchObject({
      running: false,
      remaining: 25 * 60,
      stats: { work: 60, break: 0 },
    });
  });

  it("saves new durations rather than forgetting them", () => {
    mountWith({ remaining: 300, updatedAt: 1 });

    fireEvent.click(screen.getByLabelText("Open settings M10.325"));
    fireEvent.change(screen.getByLabelText("Work (min)"), {
      target: { value: "50" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(lastWrite()).toMatchObject({
      workDuration: 50,
      mode: "work",
      remaining: 3000,
      running: false,
    });
    expect(screen.getByText("50:00")).toBeInTheDocument();
  });

  it("writes nothing when nobody is signed in", () => {
    database.ref.mockImplementation((path) => ({ path }));
    render(<FocusTimer />);
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(update).not.toHaveBeenCalled();
  });
});
