import React, { useState, useEffect, useRef, useCallback } from "react";
import { database } from "../firebase";
import { ref, onValue, update } from "firebase/database";
import SettingsCog from "./SettingsCog"; // Import the reusable component

const DailyScheduler = ({ user }) => {
  // Default time range settings
  const [startHour, setStartHour] = useState(8);
  const [endHour, setEndHour] = useState(19); 
  const [events, setEvents] = useState({});
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [showDateAddOn, setShowDateAddOn] = useState(false); // New state for toggling date picker
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

  const formatDateKey = (date) => date.toISOString().split("T")[0];

  const formatDisplayDate = (date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Navigation logic
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

  const goToToday = () => setSelectedDate(new Date());

  // Load events and settings
  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const dateKey = formatDateKey(selectedDate);
    const scheduleRef = ref(database, `users/${user.uid}/schedule/${dateKey}`);
    const settingsRef = ref(database, `users/${user.uid}/scheduleSettings`);

    const unsubscribeSettings = onValue(settingsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        if (data.startHour !== undefined) setStartHour(data.startHour);
        if (data.endHour !== undefined) setEndHour(data.endHour);
      }
    });

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

  const saveToFirebase = useCallback(
    (changesToSave) => {
      if (!user || Object.keys(changesToSave).length === 0) return;

      const dateKey = formatDateKey(selectedDate);
      update(ref(database, `users/${user.uid}/schedule/${dateKey}`), changesToSave)
        .then(() => {
          setIsSaving(false);
          setPendingChanges({});
        })
        .catch((error) => {
          console.error("Firebase Error:", error);
          setIsSaving(false);
        });
    },
    [user, selectedDate]
  );

  // Handle event change with Codacy Fix: Single state update logic
  const handleEventChange = (hour, text) => {
    if (!user) return;

    const hourKey = hour.replace(/[: ]/g, "_");

    // Update local state once
    setEvents((prev) => ({ ...prev, [hourKey]: text }));

    // Track pending changes separately for the debounce
    setPendingChanges((prev) => {
      const updated = { ...prev, [hourKey]: text };
      
      setIsSaving(true);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

      saveTimerRef.current = setTimeout(() => {
        saveToFirebase(updated);
      }, 2000);

      return updated;
    });
  };

  // Codacy Fix: Simplified property check using 'in'
  const getEventText = (hour) => {
    const hourKey = hour.replace(/[: ]/g, "_");
    return (hourKey in events) ? String(events[hourKey]) : "";
  };

  // Settings Panel Logic
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

  const cancelEditing = () => setIsEditing(false);

  const hourOptions = Array.from({ length: 24 }, (_, i) => {
    const hour12 = i > 12 ? i - 12 : i === 0 ? 12 : i;
    const ampm = i >= 12 ? "PM" : "AM";
    return { value: i, label: `${hour12}:00 ${ampm}` };
  });

  return (
    <div className="bg-white shadow rounded-md p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <button onClick={goToPreviousDay} className="p-2 rounded-md hover:bg-gray-100 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="text-center">
            <h2 className="text-xl font-semibold text-neutral-800">
              {isToday(selectedDate) ? "Today's Schedule" : formatDisplayDate(selectedDate)}
            </h2>
          </div>

          <button onClick={goToNextDay} className="p-2 rounded-md hover:bg-gray-100 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {isSaving && <span className="text-sm text-gray-500">Saving...</span>}
          {/* SettingsCog toggles the Date Picker visibility */}
          <SettingsCog onClick={() => setShowDateAddOn(!showDateAddOn)} />
          
          {!isEditing && (
            <button
              onClick={startEditing}
              className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 transition-colors"
              title="Edit Time Range"
            >
              {/* Manual gear icon for range settings */}
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Conditional Date Picker wrapped in showDateAddOn */}
      {showDateAddOn && (
        <div className="mb-6 flex justify-center animate-in fade-in slide-in-from-top-2">
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
      )}

      {isEditing && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Time Range Settings</h3>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Start:</label>
              <select value={tempStartHour} onChange={(e) => setTempStartHour(Number(e.target.value))} className="border rounded px-3 py-1.5 text-sm">
                {hourOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">End:</label>
              <select value={tempEndHour} onChange={(e) => setTempEndHour(Number(e.target.value))} className="border rounded px-3 py-1.5 text-sm">
                {hourOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
              </select>
            </div>
            <div className="flex gap-2 ml-auto">
              <button onClick={cancelEditing} className="px-3 py-1.5 text-sm text-gray-600">Cancel</button>
              <button onClick={saveSettings} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md">Save</button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-gray-500 text-center py-4">Loading schedule...</div>
      ) : (
        <div className="schedule-grid grid grid-cols-[80px_1fr] gap-1">
          {hours.map((hour) => (
            <React.Fragment key={hour}>
              <div className="time-slot bg-gray-100 p-4 border rounded text-center font-medium text-sm">{hour}</div>
              <textarea
                value={getEventText(hour)}
                onChange={(e) => handleEventChange(hour, e.target.value)}
                className="event-slot p-4 border rounded bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white min-h-[50px] w-full resize-none"
                rows={2}
              />
            </React.Fragment>
          ))}
        </div>
      )}

      {!isToday(selectedDate) && (
        <div className="mt-4 text-center">
          <button onClick={goToToday} className="text-sm text-blue-600 hover:underline">Go to today</button>
        </div>
      )}
    </div>
  );
};

export default DailyScheduler;