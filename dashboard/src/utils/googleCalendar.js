import { gapi } from 'gapi-script';

export const addToGoogleCalendar = async (taskText, dateString) => {
  try {
    const event = {
      summary: taskText,
      description: 'Assignment from Workflow App',
      start: {
        date: dateString, // This makes it an all-day assignment
      },
      end: {
        date: dateString,
      },
    };

    return await gapi.client.calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });
  } catch (err) {
    console.error('Google Calendar Sync Error:', err);
    throw err;
  }
};