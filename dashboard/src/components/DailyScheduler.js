import React, { useState, useEffect } from 'react';
import { gapi } from 'gapi-script';

const DailyScheduler = () => {
  const hours = ['8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM'];
  const [events, setEvents] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTodayEvents();
  }, []);

  const fetchTodayEvents = async () => {
    try {
      setLoading(true);
      const now = new Date();
      const startOfDay = new Date(now.setHours(0, 0, 0, 0)).toISOString();
      const endOfDay = new Date(now.setHours(23, 59, 59, 999)).toISOString();

      // Fetch events from Google Calendar for today
      const response = await gapi.client.calendar.events.list({
        'calendarId': 'primary',
        'timeMin': startOfDay,
        'timeMax': endOfDay,
        'showDeleted': false,
        'singleEvents': true,
        'orderBy': 'startTime',
      });

      const googleEvents = response.result.items;
      const mappedEvents = {};

      // Initialize hours
      hours.forEach(hour => mappedEvents[hour] = "");

      // Match Google Events to our hourly slots
      googleEvents.forEach(event => {
        const startTime = new Date(event.start.dateTime || event.start.date);
        const hourLabel = startTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        
        // Find the closest hour slot in our array
        if (mappedEvents.hasOwnProperty(hourLabel)) {
          mappedEvents[hourLabel] = event.summary;
        }
      });

      setEvents(mappedEvents);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching Google events:", error);
      setLoading(false);
    }
  };

  // Note: handleEventChange now only updates local state. 
  // In a full sync, you'd want this to update Google Calendar too!
  const handleEventChange = (hour, text) => {
    setEvents(prev => ({ ...prev, [hour]: text }));
    // Optional: Sync this back to Google or LocalStorage
  };

  return (
    <div className="bg-white p-6 rounded-md shadow">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-neutral-800">Today's Schedule</h2>
        <button 
          onClick={fetchTodayEvents}
          className="text-sm bg-blue-50 text-blue-600 px-3 py-1 rounded hover:bg-blue-100 transition-colors"
        >
          {loading ? 'Refreshing...' : 'Sync Now'}
        </button>
      </div>

      <div className="schedule-grid grid grid-cols-[100px_1fr] gap-2">
        {hours.map(hour => (
          <React.Fragment key={hour}>
            <div className="time-slot bg-gray-50 p-4 border border-gray-100 rounded text-center font-medium text-gray-600">
              {hour}
            </div>
            <div 
              className="event-slot p-4 border border-gray-100 rounded bg-white hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
              contentEditable
              onBlur={(e) => handleEventChange(hour, e.target.textContent)}
              suppressContentEditableWarning={true}
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