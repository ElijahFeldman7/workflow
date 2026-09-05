import React, { useState } from "react";
import { useDarkMode } from "../context/DarkModeContext";
import { PALETTES, usePalette } from "../lib/theme";
import { useWorkPrefs } from "../lib/workPrefs";
import SpaceManager from "./SpaceManager";
import GoogleCalendarSync from "./GoogleCalendarSync";

const Switch = ({ on, onClick, label }) => (
  <button
    onClick={onClick}
    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
      on ? "bg-primary" : "bg-muted-foreground/40"
    }`}
    role="switch"
    aria-checked={on}
    aria-label={label}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
        on ? "translate-x-6" : "translate-x-1"
      }`}
    />
  </button>
);

const UserSettings = ({ user }) => {
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const [palette, setPalette] = usePalette();
  const [workPrefs, setWorkPref] = useWorkPrefs();
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
    <div className="bg-card shadow rounded-lg p-6 max-w-2xl mx-auto transition-colors duration-200">
      <h2 className="text-2xl font-bold mb-6 text-foreground">
        Settings
      </h2>

      <section className="mb-8">
        <h3 className="text-lg font-semibold text-foreground mb-4 pb-2 border-b border-border">
          Profile
        </h3>
        <div className="flex items-center gap-4">
          <img
            className="h-16 w-16 rounded-full object-cover border-2 border-border"
            src={profileSrc}
            alt={user?.displayName || "User avatar"}
            referrerPolicy="no-referrer"
            onError={(e) => {
              const target = e.currentTarget;
              if (target.src !== fallbackAvatar) target.src = fallbackAvatar;
            }}
          />
          <div>
            <p className="text-lg font-medium text-foreground">
              {user?.displayName || "User"}
            </p>
            <p className="text-sm text-muted-foreground">
              {user?.email}
            </p>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h3 className="text-lg font-semibold text-foreground mb-4 pb-2 border-b border-border">
          Appearance
        </h3>
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              Dark Mode
            </p>
            <p className="text-sm text-muted-foreground">
              Toggle between light and dark theme
            </p>
          </div>
          <button
            onClick={toggleDarkMode}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              isDarkMode ? "bg-primary" : "bg-muted-foreground/40"
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

        <div className="py-3">
          <p className="text-sm font-medium text-foreground">
            Color Theme
          </p>
          <p className="text-sm text-muted-foreground mb-3">
            Dark mode still picks light or dark within the theme
          </p>
          <div className="flex flex-wrap gap-2">
            {PALETTES.map((option) => (
              <button
                key={option.id}
                onClick={() => setPalette(option.id)}
                aria-pressed={palette === option.id}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm transition-colors ${
                  palette === option.id
                    ? "border-primary text-foreground"
                    : "border-border text-muted-foreground hover:border-muted-foreground"
                }`}
              >
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: option.swatch }}
                />
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h3 className="text-lg font-semibold text-foreground mb-4 pb-2 border-b border-border">
          Work
        </h3>

        <div className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              Table View
            </p>
            <p className="text-sm text-muted-foreground">
              Notion-style columns instead of a grouped list
            </p>
          </div>
          <Switch
            on={workPrefs.table}
            onClick={() => setWorkPref("table", !workPrefs.table)}
            label="Table view"
          />
        </div>

        <div className="flex items-center justify-between py-3">
          <div className="pr-4">
            <p className="text-sm font-medium text-foreground">
              Smarter Capture
            </p>
            <p className="text-sm text-muted-foreground">
              Use a language model to read what you type. Downloads about 25 MB
              the first time, then works offline.
            </p>
          </div>
          <Switch
            on={workPrefs.neuralCapture}
            onClick={() =>
              setWorkPref("neuralCapture", !workPrefs.neuralCapture)
            }
            label="Smarter capture"
          />
        </div>

        <div className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              Past Events
            </p>
            <p className="text-sm text-muted-foreground">
              Keep events that have already happened in the list
            </p>
          </div>
          <Switch
            on={workPrefs.showPast}
            onClick={() => setWorkPref("showPast", !workPrefs.showPast)}
            label="Past events"
          />
        </div>

        <div className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              Class Colors
            </p>
            <p className="text-sm text-muted-foreground">
              Color-code classes, types and priorities
            </p>
          </div>
          <Switch
            on={workPrefs.colors}
            onClick={() => setWorkPref("colors", !workPrefs.colors)}
            label="Class colors"
          />
        </div>

        <div className="pt-4">
          <SpaceManager user={user} />
        </div>
      </section>

      <section className="mb-8">
        <h3 className="text-lg font-semibold text-foreground mb-4 pb-2 border-b border-border">
          Notifications
        </h3>
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              Enable Notifications
            </p>
            <p className="text-sm text-muted-foreground">
              Receive notifications for reminders and alerts
            </p>
          </div>
          <button
            onClick={() => handleNotificationsChange(!notifications)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              notifications ? "bg-primary" : "bg-muted-foreground/40"
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

      <GoogleCalendarSync user={user} />

      <section className="mb-8">
        <h3 className="text-lg font-semibold text-foreground mb-4 pb-2 border-b border-border">
          Focus Timer
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-foreground">
                Focus Duration
              </p>
              <p className="text-sm text-muted-foreground">
                Length of each focus session (minutes)
              </p>
            </div>
            <select
              value={focusDuration}
              onChange={(e) =>
                handleFocusDurationChange(parseInt(e.target.value, 10))
              }
              className="rounded-md border border-border bg-background text-foreground px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
              <p className="text-sm font-medium text-foreground">
                Break Duration
              </p>
              <p className="text-sm text-muted-foreground">
                Length of break between sessions (minutes)
              </p>
            </div>
            <select
              value={breakDuration}
              onChange={(e) =>
                handleBreakDurationChange(parseInt(e.target.value, 10))
              }
              className="rounded-md border border-border bg-background text-foreground px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value={3}>3 min</option>
              <option value={5}>5 min</option>
              <option value={10}>10 min</option>
              <option value={15}>15 min</option>
            </select>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-foreground mb-4 pb-2 border-b border-border">
          About
        </h3>
        <div className="text-sm text-muted-foreground space-y-1">
          <p>
            <span className="font-medium text-foreground">
              Version:
            </span>{" "}
            1.0.0
          </p>
          <p>
            <span className="font-medium text-foreground">
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
