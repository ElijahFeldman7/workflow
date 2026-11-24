import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "./App";
import { DarkModeProvider } from "./context/DarkModeContext";
import { onAuthStateChanged } from "firebase/auth";
import { push, ref, runTransaction } from "firebase/database";
import { logout } from "./firebase";
import { rememberGradeConnection, shouldReconnectGrades } from "./lib/useLegacyGrades";

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

jest.mock("./components/Planner", () => () => (
  <div data-testid="planner">Planner</div>
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

  describe("routing", () => {
    const signedOut = () =>
      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(null);
        return () => {};
      });

    const at = (path) => window.history.pushState({}, "", path);

    afterEach(() => at("/"));

    test("a signed out visitor lands on the marketing page, not the app", async () => {
      signedOut();
      at("/");
      renderApp();
      await waitFor(() =>
        expect(
          screen.getByRole("heading", {
            name: /School, in one place, without the setup/i,
          })
        ).toBeInTheDocument()
      );
      expect(screen.queryByTestId("work-tracker")).not.toBeInTheDocument();
    });

    test("the app path sends a signed out visitor to the home page", async () => {
      signedOut();
      at("/app");
      renderApp();
      await waitFor(() =>
        expect(
          screen.getByRole("heading", {
            name: /School, in one place, without the setup/i,
          })
        ).toBeInTheDocument()
      );
      expect(screen.queryByTestId("work-tracker")).not.toBeInTheDocument();
      expect(window.location.pathname).toBe("/");
    });

    test("the home page is the only signed out destination", async () => {
      signedOut();
      ["/app", "/nope", "/settings"].forEach((path) => {
        at(path);
        const view = renderApp();
        expect(
          screen.getByRole("heading", {
            name: /School, in one place, without the setup/i,
          })
        ).toBeInTheDocument();
        view.unmount();
      });
    });

    test("a signed in visitor at the root is sent to the app", async () => {
      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback({ displayName: "Test User", email: "test@example.com" });
        return () => {};
      });
      at("/");
      renderApp();
      await waitFor(() =>
        expect(screen.getByTestId("work-tracker")).toBeInTheDocument()
      );
    });

    test("terms and privacy are reachable without signing in", async () => {
      signedOut();
      at("/terms");
      const terms = renderApp();
      await waitFor(() =>
        expect(
          screen.getByRole("heading", { name: "Terms of Service" })
        ).toBeInTheDocument()
      );
      terms.unmount();

      at("/privacy");
      renderApp();
      await waitFor(() =>
        expect(
          screen.getByRole("heading", { name: "Privacy Policy" })
        ).toBeInTheDocument()
      );
    });

    test("an unknown path falls back to the landing page", async () => {
      signedOut();
      at("/nope");
      renderApp();
      await waitFor(() =>
        expect(
          screen.getByRole("heading", {
            name: /School, in one place, without the setup/i,
          })
        ).toBeInTheDocument()
      );
    });
  });

  describe("when user is authenticated", () => {
    const mockUser = {
      uid: "test-user",
      displayName: "Test User",
      email: "test@example.com",
      photoURL: "https://example.com/avatar.png",
    };

    beforeEach(() => {
      localStorage.removeItem("workPrefs");
      localStorage.removeItem("studentVueReconnect");
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
      expect(screen.getByText("Plan")).toBeInTheDocument();
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

      fireEvent.click(screen.getByText("Plan"));
      await waitFor(() => {
        expect(screen.getByTestId("planner")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Knowledge"));
      await waitFor(() => {
        expect(screen.getByTestId("knowledge-base")).toBeInTheDocument();
      });
      expect(screen.getByText("Knowledge")).toHaveClass(
        "bg-primary/15 text-primary"
      );
      expect(screen.getByText("Plan")).not.toHaveClass(
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

    const openSettings = () => {
      fireEvent.click(screen.getByText("Test User"));
      fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    };

    const enableGrades = () => {
      openSettings();
      fireEvent.click(screen.getByRole("switch", { name: "Show Grades tab" }));
    };

    test("Grades is opt-in and can be hidden again from Settings", () => {
      renderApp();
      expect(screen.queryByRole("button", { name: "Grades" })).not.toBeInTheDocument();
      enableGrades();
      fireEvent.click(screen.getByRole("button", { name: "Grades" }));
      expect(screen.getByRole("heading", { name: "Grades" })).toBeVisible();
      expect(screen.queryByLabelText("FCPS password")).not.toBeInTheDocument();
      openSettings();
      expect(screen.getByRole("switch", { name: "Show Grades tab" })).toBeChecked();
      fireEvent.click(screen.getByRole("switch", { name: "Show Grades tab" }));
      expect(screen.queryByRole("button", { name: "Grades" })).not.toBeInTheDocument();
    });

    test("reopens Grades and reconnects only with browser-filled credentials after reload", async () => {
      localStorage.setItem("workPrefs", JSON.stringify({ showGrades: true }));
      rememberGradeConnection(mockUser.uid, true);
      const fetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 });
      const match = Element.prototype.matches;
      const autofill = jest.spyOn(Element.prototype, "matches").mockImplementation(function (selector) {
        return selector === ":autofill" ? this.dataset.autofilled === "true" : match.call(this, selector);
      });
      try {
        renderApp();
        expect(screen.getByRole("heading", { name: "Grades" })).toBeVisible();
        const username = screen.getByLabelText("Student ID");
        const password = screen.getByLabelText("FCPS password");
        fireEvent.input(username, { target: { value: "demo" } });
        fireEvent.input(password, { target: { value: "secret" } });
        expect(global.fetch).not.toHaveBeenCalled();

        username.dataset.autofilled = "true";
        password.dataset.autofilled = "true";
        fireEvent.input(password);
        expect(await screen.findByText("FCPS rejected the student ID or password")).toBeVisible();
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(shouldReconnectGrades(mockUser.uid)).toBe(false);
      } finally {
        autofill.mockRestore();
        global.fetch = fetch;
      }
    });

    test("edits an assignment locally and restores the StudentVUE score", async () => {
      const fetch = global.fetch;
      ref.mockImplementation((_database, path) => ({ toString: () => path }));
      push.mockReturnValue({ key: "imported-algebra" });
      const save = jest.fn();
      runTransaction.mockImplementation(async (_location, update) => save(update(null)));
      const gradebook = `<Gradebook><ReportingPeriod GradePeriod="Q2"/><Courses><Course Title="Algebra 2" Period="1">
        <Marks><Mark CalculatedScoreString="B" CalculatedScoreRaw="85"><Assignments>
          <Assignment GradebookID="1" Measure="Quiz" Type="Summative" Points="85 / 100"/>
        </Assignments></Mark></Marks>
      </Course></Courses></Gradebook>`;
      global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => `
        <ProcessWebServiceRequestResult xmlns="http://edupoint.com/webservices/"><![CDATA[${gradebook}]]></ProcessWebServiceRequestResult>` });
      try {
        renderApp();
        enableGrades();
        fireEvent.click(screen.getByRole("button", { name: "Grades" }));
        fireEvent.click(screen.getByRole("button", { name: "Connect StudentVUE" }));
        fireEvent.change(screen.getByLabelText("Student ID"), { target: { value: "synthetic" } });
        fireEvent.change(screen.getByLabelText("FCPS password"), { target: { value: "synthetic" } });
        fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

        fireEvent.click(await screen.findByRole("button", { name: /^Algebra 2/ }));
        fireEvent.change(screen.getByLabelText("Earned points for Quiz"), { target: { value: "92.5" } });
        expect(screen.getByText("Projected")).toBeVisible();
        expect(screen.getByText("A", { exact: true })).toBeVisible();
        expect(screen.getByLabelText("Earned points for Quiz")).toHaveValue("92.5");
        fireEvent.click(screen.getByRole("button", { name: "Show actual" }));
        expect(screen.getByLabelText("Earned points for Quiz")).toHaveValue("85");
        expect(screen.getByLabelText("Earned points for Quiz")).toHaveAttribute("readonly");
        expect(screen.getByText("B", { exact: true })).toHaveClass("text-red-700");
        fireEvent.click(screen.getByRole("button", { name: "Show edits" }));

        fireEvent.click(screen.getByRole("button", { name: "Add assignment" }));
        fireEvent.change(screen.getByLabelText("Assignment name"), { target: { value: "Practice" } });
        fireEvent.paste(screen.getByLabelText("Earned points for new assignment"), {
          clipboardData: { getData: () => "14/15" },
        });
        fireEvent.click(screen.getByRole("button", { name: "Add", exact: true }));
        expect(screen.getByLabelText("Earned points for Practice")).toHaveValue("14");
        expect(screen.getByLabelText("Possible points for Practice")).toHaveValue("15");
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(runTransaction).toHaveBeenCalledWith(
          expect.objectContaining({ toString: expect.any(Function) }),
          expect.any(Function),
          { applyLocally: false }
        );
        expect(runTransaction.mock.calls[0][0].toString()).toBe("users/test-user/spaces");
        expect(save).toHaveBeenCalledWith({
          "imported-algebra": {
            name: "Algebra 2",
            kind: "class",
            color: expect.any(String),
            teacher: "",
            room: "",
            archived: false,
            order: 0,
            createdAt: expect.any(Number),
            studentVue: { course: "algebra 2", schoolYear: expect.any(Number) },
          },
        });

        fireEvent.click(screen.getByRole("button", { name: "Reset edits" }));
        expect(screen.getByLabelText("Earned points for Quiz")).toHaveValue("85");
        expect(screen.queryByLabelText("Earned points for Practice")).not.toBeInTheDocument();
        expect(screen.queryByText("Projected")).not.toBeInTheDocument();
      } finally {
        global.fetch = fetch;
      }
    });

    test("shows and clears a browser-only gradebook snapshot", async () => {
      const chrome = window.chrome;
      window.chrome = {
        runtime: {
          sendMessage: jest.fn((_id, _message, respond) => respond({
            status: "ok",
            courses: [{ name: "Algebra 2", period: "1", percent: 92.5, mark: "A-" }],
            term: "Q2",
          })),
        },
      };
      try {
        renderApp();
        enableGrades();
        fireEvent.click(screen.getByRole("button", { name: "Grades" }));
        fireEvent.click(screen.getByRole("button", { name: "Connect StudentVUE" }));
        fireEvent.click(screen.getByText("Browser companion"));
        fireEvent.click(screen.getByRole("button", { name: "Read Grade Book" }));
        expect(await screen.findByText("Algebra 2")).toBeVisible();
        expect(screen.getByText("A", { exact: true })).toBeVisible();

        fireEvent.click(screen.getByRole("button", { name: "Work" }));
        expect(screen.queryByRole("heading", { name: "Grades" })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Grades" }));
        expect(screen.getByText("Algebra 2")).toBeVisible();

        fireEvent.click(screen.getByRole("button", { name: "StudentVUE" }));
        fireEvent.click(screen.getByRole("button", { name: "Clear grades" }));
        expect(screen.queryByText("Algebra 2")).not.toBeInTheDocument();
      } finally {
        window.chrome = chrome;
      }
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
        { id: "plan", label: "Plan" },
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
        expect(screen.getByRole("button", { name: item.label })).toBeInTheDocument();
      });
    });
  });
});
