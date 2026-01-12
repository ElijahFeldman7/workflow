import React, { useState, useEffect } from "react";

const DailyScheduler = () => {
  const hours = [
    "8:00 AM",
    "9:00 AM",
    "10:00 AM",
    "11:00 AM",
    "12:00 PM",
    "1:00 PM",
    "2:00 PM",
    "3:00 PM",
    "4:00 PM",
    "5:00 PM",
    "6:00 PM",
    "7:00 PM",
  ];
  const [events, setEvents] = useState({});

  useEffect(() => {
    const loadedEvents = {};
    hours.forEach((hour) => {
      const eventKey = `event_${hour.replace(/ /g, "_")}`;
      loadedEvents[hour] = localStorage.getItem(eventKey) || "";
    });
    setEvents(loadedEvents);
  }, []);

  const handleEventChange = (hour, text) => {
    const newEvents = { ...events, [hour]: text };
    setEvents(newEvents);
    const eventKey = `event_${hour.replace(/ /g, "_")}`;
    localStorage.setItem(eventKey, text);
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-md p-6 max-w-4xl mx-auto transition-colors duration-200">
      <h2 className="text-2xl font-bold mb-4 text-neutral-800 dark:text-white">
        Today&apos;s Schedule
      </h2>
      <div className="schedule-grid grid grid-cols-[80px_1fr] gap-1">
        {hours.map((hour) => (
          <React.Fragment key={hour}>
            <div className="time-slot bg-gray-100 dark:bg-gray-700 p-4 border dark:border-gray-600 rounded text-center font-medium text-gray-700 dark:text-gray-200">
              {hour}
            </div>
            <div
              className="event-slot p-4 border dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:bg-white dark:focus:bg-gray-600 text-gray-800 dark:text-gray-200 min-h-[50px]"
              contentEditable
              onBlur={(e) => handleEventChange(hour, e.target.textContent)}
              suppressContentEditableWarning={true}
              aria-label={`Event for ${hour}`}
            >
              {events[hour]}
            </div>
          </React.Fragment>
        ))}
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-4 text-center">
        Click on any time slot to add or edit events.
      </p>
    </div>
  );
};

export default DailyScheduler;
