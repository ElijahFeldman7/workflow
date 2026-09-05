import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "./App";
import { DarkModeProvider } from "./context/DarkModeContext";
import { onAuthStateChanged } from "firebase/auth";
import { logout } from "./firebase";

const renderApp = () => {
  return render(
    <DarkModeProvider>
      <App />
    </DarkModeProvider>
  );
};

jest.mock("firebase/auth", () => ({
  ...jest.requireActual("firebase/auth"),
  onAuthStateChanged: jest.fn(),
}));

jest.mock("./firebase", () => ({
  auth: {
    currentUser: {
      displayName: "Test User",
      email: "test@example.com",
      photoURL: "https://example.com/avatar.png",
    },
  },
  logout: jest.fn(),
  signInWithGoogle: jest.fn(),
}));

jest.mock("./components/TaskManager", () => () => (
  <div data-testid="task-manager">TaskManager</div>
));
jest.mock("./components/WorkTracker", () => () => (
  <div data-testid="work-tracker">WorkTracker</div>
));
jest.mock("./components/KnowledgeBase", () => () => (
  <div data-testid="knowledge-base">KnowledgeBase</div>
));
jest.mock("./components/HabitTracker", () => () => (
  <div data-testid="habit-tracker">HabitTracker</div>
));
jest.mock("./components/QuickLinks", () => () => (
  <div data-testid="quick-links">QuickLinks</div>
));
jest.mock("./components/CalendarView", () => () => (
  <div data-testid="calendar-view">CalendarView</div>
));
jest.mock("./components/FocusTimer", () => () => (
  <div data-testid="focus-timer">FocusTimer</div>
));

describe("App component", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("renders loading state initially", () => {
    onAuthStateChanged.mockImplementation((auth, callback) => {
      return () => {};
    });

    renderApp();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  test("renders sign-in page when user is not authenticated", async () => {
    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(null);
      return () => {};
    });

    renderApp();
    await waitFor(() => {
      expect(screen.getByText("Sign in with Google")).toBeInTheDocument();
    });
  });

  describe("when user is authenticated", () => {
    const mockUser = {
      displayName: "Test User",
      email: "test@example.com",
      photoURL: "https://example.com/avatar.png",
    };

    beforeEach(() => {
      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser);
        return () => {};
      });
    });

    test("renders the main application", async () => {
      renderApp();
      await waitFor(() => {
        expect(screen.getByText("Workflow")).toBeInTheDocument();
      });
      expect(screen.getByText("Tasks")).toBeInTheDocument();
    });

    test("renders WorkTracker by default", async () => {
      renderApp();
      await waitFor(() => {
        expect(screen.getByTestId("work-tracker")).toBeInTheDocument();
      });
      expect(screen.getByText("Work")).toHaveClass("bg-primary/15 text-primary");
    });

    test("switches tabs when clicking navigation items", async () => {
      renderApp();
      await waitFor(() => {
        expect(screen.getByTestId("work-tracker")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Tasks"));
      await waitFor(() => {
        expect(screen.getByTestId("task-manager")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Knowledge"));
      await waitFor(() => {
        expect(screen.getByTestId("knowledge-base")).toBeInTheDocument();
      });
      expect(screen.getByText("Knowledge")).toHaveClass(
        "bg-primary/15 text-primary"
      );
      expect(screen.getByText("Tasks")).not.toHaveClass(
        "bg-primary/15 text-primary"
      );

      fireEvent.click(screen.getByText("Calendar"));
      await waitFor(() => {
        expect(screen.getByTestId("calendar-view")).toBeInTheDocument();
      });
      expect(screen.getByText("Calendar")).toHaveClass(
        "bg-primary/15 text-primary"
      );
      expect(screen.getByText("Knowledge")).not.toHaveClass(
        "bg-primary/15 text-primary"
      );

      fireEvent.click(screen.getByText("Focus"));
      await waitFor(() => {
        expect(screen.getByTestId("focus-timer")).toBeInTheDocument();
      });
      expect(screen.getByText("Focus")).toHaveClass("bg-primary/15 text-primary");
      expect(screen.getByText("Calendar")).not.toHaveClass(
        "bg-primary/15 text-primary"
      );

      fireEvent.click(screen.getByText("Habits"));
      await waitFor(() => {
        expect(screen.getByTestId("habit-tracker")).toBeInTheDocument();
      });
      expect(screen.getByText("Habits")).toHaveClass(
        "bg-primary/15 text-primary"
      );
      expect(screen.getByText("Focus")).not.toHaveClass(
        "bg-primary/15 text-primary"
      );

      fireEvent.click(screen.getByText("Links"));
      await waitFor(() => {
        expect(screen.getByTestId("quick-links")).toBeInTheDocument();
      });
      expect(screen.getByText("Links")).toHaveClass("bg-primary/15 text-primary");
      expect(screen.getByText("Habits")).not.toHaveClass(
        "bg-primary/15 text-primary"
      );
    });

    test("logs out when sign out button is clicked", async () => {
      renderApp();

      await waitFor(() => {
        expect(screen.getByText("Test User")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Test User"));

      await waitFor(() => {
        expect(screen.getByText("Sign out")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Sign out"));

      expect(logout).toHaveBeenCalledTimes(1);
    });

    test("unsubscribes from auth state changes on unmount", () => {
      const unsubscribe = jest.fn();
      onAuthStateChanged.mockReturnValue(unsubscribe);

      const { unmount } = renderApp();
      unmount();

      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });

    test("displays user email in dropdown", async () => {
      renderApp();
      await waitFor(() => {
        expect(screen.getByText("Test User")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Test User"));

      await waitFor(() => {
        expect(screen.getByText(mockUser.email)).toBeInTheDocument();
      });
    });

    test("clicking logo switches to work tab", async () => {
      renderApp();
      await waitFor(() => {
        expect(screen.getByTestId("work-tracker")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Knowledge"));
      await waitFor(() => {
        expect(screen.getByTestId("knowledge-base")).toBeInTheDocument();
      });
      expect(screen.getByText("Knowledge")).toHaveClass(
        "bg-primary/15 text-primary"
      );

      fireEvent.click(screen.getByAltText("Workflow Logo"));
      await waitFor(() => {
        expect(screen.getByTestId("work-tracker")).toBeInTheDocument();
      });
      expect(screen.getByText("Work")).toHaveClass("bg-primary/15 text-primary");
      expect(screen.getByText("Knowledge")).not.toHaveClass(
        "bg-primary/15 text-primary"
      );
    });

    test("navItems array is correctly structured", () => {
      const expectedNavItems = [
        { id: "work", label: "Work" },
        { id: "tasks", label: "Tasks" },
        { id: "notes", label: "Knowledge" },
        { id: "calendar", label: "Calendar" },
        { id: "focus", label: "Focus" },
        { id: "habits", label: "Habits" },
        { id: "links", label: "Links" },
      ];

      renderApp();

      const navButtons = screen.getAllByRole("button");
      const renderedNavItems = navButtons
        .map((button) => button.textContent)
        .filter((label) =>
          expectedNavItems.some((item) => item.label === label)
        );

      expect(renderedNavItems).toHaveLength(expectedNavItems.length);

      expectedNavItems.forEach((item) => {
        expect(screen.getByText(item.label)).toBeInTheDocument();
      });
    });
  });
});
