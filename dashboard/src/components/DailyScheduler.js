import React, { useState, useEffect } from 'react';

const DailyScheduler = () => {
  const hours = ['8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM'];
  const [events, setEvents] = useState({});

  useEffect(() => {
    const loadedEvents = {};
    hours.forEach(hour => {
      const eventKey = `event_${hour.replace(/ /g, '_')}`;
      loadedEvents[hour] = localStorage.getItem(eventKey) || '';
    });
    setEvents(loadedEvents);
  }, []);

  const handleEventChange = (hour, text) => {
    const newEvents = { ...events, [hour]: text };
    setEvents(newEvents);
    const eventKey = `event_${hour.replace(/ /g, '_')}`;
    localStorage.setItem(eventKey, text);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">today Schedule</h2>
      <div className="schedule-grid grid grid-cols-[80px_1fr] gap-1">
        {hours.map(hour => (
          <React.Fragment key={hour}>
            <div className="time-slot bg-gray-100 p-4 border rounded text-center font-medium">{hour}</div>
            <div 
              className="event-slot p-4 border rounded bg-gray-50 focus:outline-none focus:border-blue-500 focus:bg-white"
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
    </div>
  );
};

export default DailyScheduler;