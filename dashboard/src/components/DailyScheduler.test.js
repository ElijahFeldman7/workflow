import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import DailyScheduler from "./DailyScheduler";

// Mock firebase/database module (remove the ../firebase mock entirely)
jest.mock("firebase/database", () => ({
  ref: jest.fn(() => ({})),
  onValue: jest.fn(),
  update: jest.fn(() => Promise.resolve()),
}));

// Get the mocks
import { onValue, update, ref } from "firebase/database";

describe("DailyScheduler", () => {
  const mockUser = {
    uid: "test-user-123",
    email: "test@example.com",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Setup mock to handle both settings and events refs
    onValue.mockImplementation((refObj, callback) => {
      // Return empty data for both refs
      callback({
        val: () => null,
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
    update.mockReturnValue(Promise.resolve());

    render(<DailyScheduler user={mockUser} />);

    const eventSlot = screen.getByLabelText("Event for 8:00 AM");

    // Simulate typing in contentEditable div
    eventSlot.textContent = "Meeting";
    fireEvent.input(eventSlot);

    // Trigger blur to call handleEventChange
    fireEvent.blur(eventSlot);

    // Firebase should not be called immediately
    expect(update).not.toHaveBeenCalled();

    // Fast-forward 2 seconds (debounce time) wrapped in act
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    // Wait for async update to complete
    await waitFor(() => {
      expect(update).toHaveBeenCalledTimes(1);
    });
  });

  test("navigates to previous day", () => {
    render(<DailyScheduler user={mockUser} />);

    const prevButton = screen.getByLabelText("Previous day");
    fireEvent.click(prevButton);

    // Should show "Go to today" button when not on today
    expect(screen.getByText("Go to today")).toBeInTheDocument();
  });

  test("navigates to next day", () => {
    render(<DailyScheduler user={mockUser} />);

    const nextButton = screen.getByLabelText("Next day");
    fireEvent.click(nextButton);

    // Should show "Go to today" button when not on today
    expect(screen.getByText("Go to today")).toBeInTheDocument();
  });
});
