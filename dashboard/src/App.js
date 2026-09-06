import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { auth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";

import Navbar from "./components/Navbar";
import Landing from "./components/landing/Landing";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";

import TaskManager from "./components/TaskManager";
import WorkTracker from "./components/WorkTracker";
import KnowledgeBase from "./components/KnowledgeBase";
import CalendarView from "./components/CalendarView";
import FocusTimer from "./components/FocusTimer";
import HabitTracker from "./components/HabitTracker";
import QuickLinks from "./components/QuickLinks";
import UserSettings from "./components/UserSettings";

export const buildNavItems = (user) => [
  { id: "work", label: "Work", component: <WorkTracker user={user} /> },
  { id: "tasks", label: "Tasks", component: <TaskManager user={user} /> },
  { id: "notes", label: "Knowledge", component: <KnowledgeBase user={user} /> },
  { id: "calendar", label: "Calendar", component: <CalendarView user={user} /> },
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
  const [activeTab, setActiveTab] = useState("work");
  const navItems = buildNavItems(user);
  const ActiveComponent = navItems.find(
    (item) => item.id === activeTab
  )?.component;

  return (
    <div className="bg-background min-h-screen flex flex-col transition-colors duration-200">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        navItems={navItems.filter((item) => !item.hidden)}
        user={user}
        onOpenSettings={() => setActiveTab("settings")}
      />

      <main className="flex-1 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">{ActiveComponent}</div>
      </main>
    </div>
  );
};

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
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
          element={user ? <Dashboard user={user} /> : <Navigate to="/" replace />}
        />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
