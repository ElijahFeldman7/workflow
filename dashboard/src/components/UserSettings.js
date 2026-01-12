import React, { useState } from "react";
import { useDarkMode } from "../context/DarkModeContext";

const UserSettings = ({ user }) => {
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem("notificationsEnabled");
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [focusDuration, setFocusDuration] = useState(() => {
    const saved = localStorage.getItem("focusDuration");
    return saved !== null ? parseInt(saved, 10) : 25;
  });
  const [breakDuration, setBreakDuration] = useState(() => {
    const saved = localStorage.getItem("breakDuration");
    return saved !== null ? parseInt(saved, 10) : 5;
  });

  const handleNotificationsChange = (enabled) => {
    setNotifications(enabled);
    localStorage.setItem("notificationsEnabled", JSON.stringify(enabled));
  };

  const handleFocusDurationChange = (duration) => {
    setFocusDuration(duration);
    localStorage.setItem("focusDuration", duration.toString());
  };

  const handleBreakDurationChange = (duration) => {
    setBreakDuration(duration);
    localStorage.setItem("breakDuration", duration.toString());
  };

  const fallbackAvatar =
    typeof user?.displayName === "string"
      ? `https://ui-avatars.com/api/?name=${encodeURIComponent(
          user.displayName
        )}&size=128`
      : "https://ui-avatars.com/api/?name=User&size=128";

  const profileSrc =
    user?.photoURL ||
    (user?.providerData &&
      user.providerData[0] &&
      user.providerData[0].photoURL) ||
    fallbackAvatar;

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 max-w-2xl mx-auto transition-colors duration-200">
      <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
        Settings
      </h2>

      {/* Profile Section */}
      <section className="mb-8">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
          Profile
        </h3>
        <div className="flex items-center gap-4">
          <img
            className="h-16 w-16 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
            src={profileSrc}
            alt={user?.displayName || "User avatar"}
            referrerPolicy="no-referrer"
            onError={(e) => {
              const target = e.currentTarget;
              if (target.src !== fallbackAvatar) target.src = fallbackAvatar;
            }}
          />
          <div>
            <p className="text-lg font-medium text-gray-900 dark:text-white">
              {user?.displayName || "User"}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {user?.email}
            </p>
          </div>
        </div>
      </section>

      {/* Appearance Section */}
      <section className="mb-8">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
          Appearance
        </h3>
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              Dark Mode
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Toggle between light and dark theme
            </p>
          </div>
          <button
            onClick={toggleDarkMode}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              isDarkMode ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
            }`}
            role="switch"
            aria-checked={isDarkMode}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isDarkMode ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </section>

      {/* Notifications Section */}
      <section className="mb-8">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
          Notifications
        </h3>
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              Enable Notifications
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Receive notifications for reminders and alerts
            </p>
          </div>
          <button
            onClick={() => handleNotificationsChange(!notifications)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              notifications ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
            }`}
            role="switch"
            aria-checked={notifications}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                notifications ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </section>

      {/* Focus Timer Settings */}
      <section className="mb-8">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
          Focus Timer
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Focus Duration
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Length of each focus session (minutes)
              </p>
            </div>
            <select
              value={focusDuration}
              onChange={(e) =>
                handleFocusDurationChange(parseInt(e.target.value, 10))
              }
              className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={15}>15 min</option>
              <option value={20}>20 min</option>
              <option value={25}>25 min</option>
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>60 min</option>
            </select>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Break Duration
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Length of break between sessions (minutes)
              </p>
            </div>
            <select
              value={breakDuration}
              onChange={(e) =>
                handleBreakDurationChange(parseInt(e.target.value, 10))
              }
              className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={3}>3 min</option>
              <option value={5}>5 min</option>
              <option value={10}>10 min</option>
              <option value={15}>15 min</option>
            </select>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
          About
        </h3>
        <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
          <p>
            <span className="font-medium text-gray-700 dark:text-gray-300">
              Version:
            </span>{" "}
            1.0.0
          </p>
          <p>
            <span className="font-medium text-gray-700 dark:text-gray-300">
              Workflow
            </span>{" "}
            - Your personal productivity dashboard
          </p>
        </div>
      </section>
    </div>
  );
};

export default UserSettings;
