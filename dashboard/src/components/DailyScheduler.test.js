import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import DailyScheduler from './DailyScheduler';

describe('DailyScheduler', () => {
  beforeEach(() => {
    let store = {};
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => store[key] || null);
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      store[key] = value.toString();
    });
    jest.spyOn(Storage.prototype, 'clear').mockImplementation(() => {
      store = {};
    });
    localStorage.clear();
    jest.clearAllMocks();
  });

  test('renders the scheduler with the correct title', () => {
    render(<DailyScheduler />);
    expect(screen.getByText(/today schedule/i)).toBeInTheDocument();
  });

  test('renders all time slots', () => {
    render(<DailyScheduler />);
    const hours = [
      '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', 
      '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', 
      '6:00 PM', '7:00 PM'
    ];
    hours.forEach(hour => {
      expect(screen.getByText(hour)).toBeInTheDocument();
    });
  });

  test('loads events from localStorage on initial render', () => {
    const eventKey = 'event_9:00_AM';
    const eventText = 'Morning meeting';
    localStorage.setItem(eventKey, eventText);
    
    render(<DailyScheduler />);
    
    // We search for the text content within the editable area
    expect(screen.getByText(eventText)).toBeInTheDocument();
  });

  test('saves an event to localStorage when the user types in a time slot', () => {
    render(<DailyScheduler />);
    
    const timeLabel = screen.getByText('9:00 AM');
    const inputSlot = timeLabel.closest('div').querySelector('[contenteditable="true"]') 
                      || timeLabel.nextElementSibling;

    fireEvent.input(inputSlot, { target: { textContent: 'Team Standup' } });
    fireEvent.blur(inputSlot);

    expect(localStorage.setItem).toHaveBeenCalledWith('event_9:00_AM', 'Team Standup');
    expect(localStorage.getItem('event_9:00_AM')).toBe('Team Standup');
  });
});