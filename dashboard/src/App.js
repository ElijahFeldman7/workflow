import React, { useState, useEffect } from "react";
import { auth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { gapi } from "gapi-script"; // Added for Google Calendar integration

import Navbar from "./components/Navbar";
import SignIn from "./components/SignIn";

import TaskManager from "./components/TaskManager";
import KnowledgeBase from "./components/KnowledgeBase";
import DailyScheduler from "./components/DailyScheduler";
import FocusTimer from "./components/FocusTimer";
import HabitTracker from "./components/HabitTracker";
import QuickLinks from "./components/QuickLinks";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("tasks");

  // 1. Initialize Google API (gapi)
  useEffect(() => {
    const initClient = () => {
      gapi.client.init({
        discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"],
        scope: "https://www.googleapis.com/auth/calendar.events",
      });
    };
    gapi.load("client:auth2", initClient);
  }, []);

  // 2. Handle Firebase Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log("Auth state changed:", currentUser);
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const navItems = [
    { id: "tasks", label: "Tasks", component: <TaskManager user={user} /> },
    {
      id: "notes",
      label: "Knowledge",
      component: <KnowledgeBase user={user} />,
    },
    {
      id: "scheduler",
      label: "Schedule",
      component: <DailyScheduler user={user} />,
    },
    { id: "focus", label: "Focus", component: <FocusTimer /> },
    { id: "habits", label: "Habits", component: <HabitTracker user={user} /> },
    { id: "links", label: "Links", component: <QuickLinks user={user} /> },
  ];

  const ActiveComponent = navItems.find(
    (item) => item.id === activeTab
  )?.component;

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-gray-600 font-medium">Loading Workflow...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <SignIn />;
  }

  return (
    <div className="bg-blue-100 min-h-screen flex flex-col">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        navItems={navItems}
        user={user}
      />

      <main className="flex-1 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">{ActiveComponent}</div>
      </main>
    </div>
  );
}

export default App;