import React, { useRef, useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { auth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";

import Navbar from "./components/Navbar";
import Landing from "./components/landing/Landing";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";

import Planner from "./components/Planner";
import WorkTracker from "./components/WorkTracker";
import KnowledgeBase from "./components/KnowledgeBase";
import CalendarView from "./components/CalendarView";
import Grades from "./components/Grades";
import FocusTimer from "./components/FocusTimer";
import HabitTracker from "./components/HabitTracker";
import QuickLinks from "./components/QuickLinks";
import UserSettings from "./components/UserSettings";
import { useWorkPrefs } from "./lib/workPrefs";
import { rememberGradeConnection, shouldReconnectGrades } from "./lib/useLegacyGrades";

export const buildNavItems = (user, activeTab, { showGrades, showGradeGraph }) => [
  { id: "work", label: "Work", component: <WorkTracker user={user} /> },
  { id: "plan", label: "Plan", component: <Planner user={user} /> },
  { id: "notes", label: "Knowledge", component: <KnowledgeBase user={user} /> },
  { id: "calendar", label: "Calendar", component: <CalendarView user={user} /> },
  ...(showGrades ? [{
    id: "grades",
    label: "Grades",
    component: <Grades user={user} active={activeTab === "grades"} showGraph={showGradeGraph} />,
  }] : []),
  { id: "focus", label: "Focus", component: <FocusTimer user={user} /> },
  { id: "habits", label: "Habits", component: <HabitTracker user={user} /> },
  { id: "links", label: "Links", component: <QuickLinks user={user} /> },
  {
    id: "settings",
    label: "Settings",
    component: <UserSettings user={user} />,
    hidden: true,
  },
];

const Dashboard = ({ user }) => {
  const [preferences] = useWorkPrefs();
  const [selectedTab, setActiveTab] = useState(() =>
    preferences.showGrades && shouldReconnectGrades(user.uid) ? "grades" : "work"
  );
  useEffect(() => {
    if (!preferences.showGrades) rememberGradeConnection(user.uid, false);
  }, [preferences.showGrades, user.uid]);
  const activeTab = selectedTab === "grades" && !preferences.showGrades ? "work" : selectedTab;
  const navItems = buildNavItems(user, activeTab, preferences);
  const gradesTab = navItems.find((item) => item.id === "grades");
  const gradesActive = activeTab === "grades";
  const ActiveComponent = navItems.find((item) => item.id === activeTab)?.component;

  return (
    <div className={`bg-background min-h-screen flex flex-col transition-colors duration-200 ${gradesActive ? "grades-shell" : ""}`}>
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        navItems={navItems.filter((item) => !item.hidden)}
        user={user}
        onOpenSettings={() => setActiveTab("settings")}
      />

      <main className={`flex-1 py-8 px-4 sm:px-6 lg:px-8 ${gradesActive ? "grades-page" : ""}`}>
        <div className="max-w-6xl mx-auto">
          {!gradesActive && ActiveComponent}
          {gradesTab && <div hidden={!gradesActive}>{gradesTab.component}</div>}
        </div>
      </main>
    </div>
  );
};

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const previousUid = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (previousUid.current !== currentUser?.uid) rememberGradeConnection(previousUid.current, false);
      previousUid.current = currentUser?.uid;
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background text-foreground">
        Loading...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={user ? <Navigate to="/app" replace /> : <Landing />}
        />
        <Route
          path="/app"
          element={user ? <Dashboard key={user.uid} user={user} /> : <Navigate to="/" replace />}
        />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
