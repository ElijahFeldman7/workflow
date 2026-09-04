import React, { useState, useEffect } from "react";
import { auth, logout } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useDarkMode } from "./context/DarkModeContext";

import Navbar from "./components/Navbar";
import SignIn from "./components/SignIn";

import TaskManager from "./components/TaskManager";
import WorkTracker from "./components/WorkTracker";
import KnowledgeBase from "./components/KnowledgeBase";
import CalendarView from "./components/CalendarView";
import FocusTimer from "./components/FocusTimer";
import HabitTracker from "./components/HabitTracker";
import QuickLinks from "./components/QuickLinks";
import UserSettings from "./components/UserSettings";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("work");
  const { isDarkMode } = useDarkMode();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log("Auth state changed:", currentUser);
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const navItems = [
    { id: "work", label: "Work", component: <WorkTracker user={user} /> },
    { id: "tasks", label: "Tasks", component: <TaskManager user={user} /> },
    {
      id: "notes",
      label: "Knowledge",
      component: <KnowledgeBase user={user} />,
    },
    {
      id: "calendar",
      label: "Calendar",
      component: <CalendarView user={user} />,
    },
    { id: "focus", label: "Focus", component: <FocusTimer /> },
    { id: "habits", label: "Habits", component: <HabitTracker user={user} /> },
    { id: "links", label: "Links", component: <QuickLinks user={user} /> },
    {
      id: "settings",
      label: "Settings",
      component: <UserSettings user={user} />,
      hidden: true,
    },
  ];

  const ActiveComponent = navItems.find(
    (item) => item.id === activeTab
  )?.component;

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background dark:text-white">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <SignIn />;
  }

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
}

export default App;
