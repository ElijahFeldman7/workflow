import React, { useState, useEffect, useRef, useCallback } from "react";
import { database } from "../firebase";
import { ref, onValue, update } from "firebase/database";

const DailyScheduler = ({ user }) => {
  // Default time range settings
  const [startHour, setStartHour] = useState(8);
  const [endHour, setEndHour] = useState(19); // 7 PM in 24-hour format
  const [events, setEvents] = useState({});
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [tempStartHour, setTempStartHour] = useState(8);
  const [tempEndHour, setTempEndHour] = useState(19);
  const [pendingChanges, setPendingChanges] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // Debounce timer ref
  const saveTimerRef = useRef(null);

  // Generate hours array based on start/end time
  const generateHours = useCallback(() => {
    const hoursArray = [];
    for (let i = startHour; i <= endHour; i++) {
      const hour12 = i > 12 ? i - 12 : i === 0 ? 12 : i;
      const ampm = i >= 12 ? "PM" : "AM";
      hoursArray.push(`${hour12}:00 ${ampm}`);
    }
    return hoursArray;
  }, [startHour, endHour]);

  const hours = generateHours();

  // Format date as YYYY-MM-DD for Firebase key
  const formatDateKey = (date) => {
    return date.toISOString().split("T")[0];
  };

  // Format date for display
  const formatDisplayDate = (date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Check if selected date is today
  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Navigate days
  const goToPreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  };

  const goToNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  // Load events and settings from Firebase
  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const dateKey = formatDateKey(selectedDate);
    const scheduleRef = ref(database, `users/${user.uid}/schedule/${dateKey}`);
    const settingsRef = ref(database, `users/${user.uid}/scheduleSettings`);

    // Load settings
    const unsubscribeSettings = onValue(settingsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        if (data.startHour !== undefined) setStartHour(data.startHour);
        if (data.endHour !== undefined) setEndHour(data.endHour);
      }
    });

    // Load events for selected date
    const unsubscribeEvents = onValue(scheduleRef, (snapshot) => {
      const data = snapshot.val();
      setEvents(data || {});
      setIsLoading(false);
    });

    return () => {
      unsubscribeSettings();
      unsubscribeEvents();
    };
  }, [user, selectedDate]);

  // Debounced save to Firebase
  const saveToFirebase = useCallback(
    (changesToSave) => {
      if (!user || Object.keys(changesToSave).length === 0) return;

      const dateKey = formatDateKey(selectedDate);
      update(
        ref(database, `users/${user.uid}/schedule/${dateKey}`),
        changesToSave
      )
        .then(() => {
          setIsSaving(false);
          setPendingChanges({});
        })
        .catch((error) => {
          console.error("Error saving to Firebase:", error);
          setIsSaving(false);
        });
    },
    [user, selectedDate]
  );

  // Handle event change with debounce
  const handleEventChange = (hour, text) => {
    if (!user) return;

    const hourKey = hour.replace(/[: ]/g, "_");

    // Update local state immediately
    setEvents((prev) => ({ ...prev, [hourKey]: text }));

    // Track pending changes
    const newPendingChanges = { ...pendingChanges, [hourKey]: text };
    setPendingChanges(newPendingChanges);
    setIsSaving(true);

    // Clear existing timer
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    // Set new debounced save (2 seconds after last change)
    saveTimerRef.current = setTimeout(() => {
      saveToFirebase(newPendingChanges);
    }, 2000);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  // Clear pending saves when date changes to prevent race condition
  useEffect(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    setPendingChanges({});
    setIsSaving(false);
  }, [selectedDate]);

  // Get event text for a specific hour
  const getEventText = (hour) => {
    const hourKey = hour.replace(/[: ]/g, "_");
    return Object.prototype.hasOwnProperty.call(events, hourKey)
      ? String(events[hourKey])
      : "";
  };

  // Settings handlers
  const startEditing = () => {
    setTempStartHour(startHour);
    setTempEndHour(endHour);
    setIsEditing(true);
  };

  const saveSettings = () => {
    if (tempEndHour <= tempStartHour) {
      alert("End time must be after start time");
      return;
    }

    setStartHour(tempStartHour);
    setEndHour(tempEndHour);
    setIsEditing(false);

    if (user) {
      update(ref(database, `users/${user.uid}/scheduleSettings`), {
        startHour: tempStartHour,
        endHour: tempEndHour,
      });
    }
  };

  const cancelEditing = () => {
    setIsEditing(false);
  };

  // Generate hour options for dropdown
  const hourOptions = [];
  for (let i = 0; i <= 23; i++) {
    const hour12 = i > 12 ? i - 12 : i === 0 ? 12 : i;
    const ampm = i >= 12 ? "PM" : "AM";
    hourOptions.push({ value: i, label: `${hour12}:00 ${ampm}` });
  }

  return (
    <div className="bg-white shadow rounded-md p-6 max-w-4xl mx-auto">
      {/* Header with Settings */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={goToPreviousDay}
            className="p-2 rounded-md hover:bg-gray-100 transition-colors"
            aria-label="Previous day"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-gray-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          <div className="text-center">
            <h2 className="text-xl font-semibold text-neutral-800">
              {isToday(selectedDate)
                ? "Today's Schedule"
                : formatDisplayDate(selectedDate)}
            </h2>
            {!isToday(selectedDate) && (
              <button
                onClick={goToToday}
                className="text-sm text-blue-600 hover:text-blue-800 mt-1"
              >
                Go to today
              </button>
            )}
          </div>

          <button
            onClick={goToNextDay}
            className="p-2 rounded-md hover:bg-gray-100 transition-colors"
            aria-label="Next day"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-gray-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {isSaving && <span className="text-sm text-gray-500">Saving...</span>}
          {!isEditing && (
            <button
              onClick={startEditing}
              className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 transition-colors"
              title="Edit Time Range"
              aria-label="Edit time range"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Settings Panel */}
      {isEditing && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Time Range Settings
          </h3>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Start:</label>
              <select
                value={tempStartHour}
                onChange={(e) => setTempStartHour(Number(e.target.value))}
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                {hourOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">End:</label>
              <select
                value={tempEndHour}
                onChange={(e) => setTempEndHour(Number(e.target.value))}
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                {hourOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 ml-auto">
              <button
                onClick={cancelEditing}
                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveSettings}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Date Picker */}
      <div className="mb-6 flex justify-center">
        <input
          type="date"
          value={formatDateKey(selectedDate)}
          onChange={(e) => {
            const [year, month, day] = e.target.value.split("-").map(Number);
            setSelectedDate(new Date(year, month - 1, day));
          }}
          className="border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="text-gray-500 text-center py-4">
          Loading schedule...
        </div>
      )}

      {/* Schedule Grid */}
      {!isLoading && (
        <div className="schedule-grid grid grid-cols-[80px_1fr] gap-1">
          {hours.map((hour) => (
            <React.Fragment key={hour}>
              <div className="time-slot bg-gray-100 p-4 border rounded text-center font-medium text-sm">
                {hour}
              </div>
              <textarea
                value={getEventText(hour)}
                onChange={(e) => handleEventChange(hour, e.target.value)}
                className="event-slot p-4 border rounded bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white min-h-[50px] w-full resize-none"
                rows={2}
                aria-label={`Event for ${hour}`}
              />
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Helper Text */}
      <p className="text-sm text-gray-500 mt-4 text-center">
        Type in any time slot to add or edit events. Changes are saved
        automatically 2 seconds after you stop typing.
      </p>
    </div>
  );
};

export default DailyScheduler;
