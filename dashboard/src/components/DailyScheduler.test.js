import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DailyScheduler from "./DailyScheduler";
import { database } from "../firebase";

// Mock Firebase - following the same pattern as HabitTracker.test.js
jest.mock("../firebase", () => {
  const mockRef = {
    _path: {
      pieces_: [],
    },
    root: {
      _path: {
        pieces_: [],
      },
    },
  };
  return {
    database: {
      _checkNotDeleted: jest.fn(),
      ref: jest.fn(() => mockRef),
      onValue: jest.fn(),
      update: jest.fn(),
    },
  };
});

// Mock firebase/database module
jest.mock("firebase/database", () => ({
  ref: jest.fn(() => ({})),
  onValue: jest.fn(),
  update: jest.fn(() => Promise.resolve()),
}));

// Get the mock for onValue from firebase/database
import { onValue, update } from "firebase/database";

describe("DailyScheduler", () => {
  const mockUser = {
    uid: "test-user-123",
    email: "test@example.com",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Setup the mock to return data and an unsubscribe function
    onValue.mockImplementation((ref, callback) => {
      callback({
        val: () => ({}),
      });
      return jest.fn(); // Return unsubscribe function
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("renders the scheduler with the correct title", () => {
    render(<DailyScheduler user={mockUser} />);

    expect(screen.getByText("Today's Schedule")).toBeInTheDocument();
  });

  test("renders date navigation buttons", () => {
    render(<DailyScheduler user={mockUser} />);

    expect(screen.getByLabelText("Previous day")).toBeInTheDocument();
    expect(screen.getByLabelText("Next day")).toBeInTheDocument();
  });

  test("renders date picker", () => {
    render(<DailyScheduler user={mockUser} />);

    const datePicker = document.querySelector('input[type="date"]');
    expect(datePicker).toBeInTheDocument();
  });

  test("renders all default time slots", () => {
    render(<DailyScheduler user={mockUser} />);

    // Default hours: 8 AM to 7 PM
    expect(screen.getByText("8:00 AM")).toBeInTheDocument();
    expect(screen.getByText("12:00 PM")).toBeInTheDocument();
    expect(screen.getByText("7:00 PM")).toBeInTheDocument();
  });

  test("renders event slots with aria-labels for accessibility", () => {
    render(<DailyScheduler user={mockUser} />);

    expect(screen.getByLabelText("Event for 8:00 AM")).toBeInTheDocument();
    expect(screen.getByLabelText("Event for 12:00 PM")).toBeInTheDocument();
  });

  test("renders settings button", () => {
    render(<DailyScheduler user={mockUser} />);

    expect(screen.getByLabelText("Edit time range")).toBeInTheDocument();
  });

  test("opens settings panel when settings button is clicked", () => {
    render(<DailyScheduler user={mockUser} />);

    const settingsButton = screen.getByLabelText("Edit time range");
    fireEvent.click(settingsButton);

    expect(screen.getByText("Time Range Settings")).toBeInTheDocument();
    expect(screen.getByText("Start:")).toBeInTheDocument();
    expect(screen.getByText("End:")).toBeInTheDocument();
  });

  test("debounces Firebase writes", async () => {
    // Setup update mock to return a resolved promise
    update.mockReturnValue(Promise.resolve());

    render(<DailyScheduler user={mockUser} />);

    const eventSlot = screen.getByLabelText("Event for 8:00 AM");

    // Simulate typing
    fireEvent.blur(eventSlot, { target: { textContent: "Meeting" } });

    // Firebase should not be called immediately
    expect(update).not.toHaveBeenCalled();

    // Fast-forward 2 seconds (debounce time)
    jest.advanceTimersByTime(2000);

    // Now Firebase should be called
    expect(update).toHaveBeenCalled();
  });
});
