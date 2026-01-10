import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import DailyScheduler from './DailyScheduler';

describe('DailyScheduler', () => {
  let store = {};
  
  beforeAll(() => {
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn((key) => store[key] || null),
        setItem: jest.fn((key, value) => {
          store[key] = value.toString();
        }),
        clear: jest.fn(() => {
          store = {};
        }),
      },
      writable: true,
    });
  });

  beforeEach(() => {
    store = {};
    jest.clearAllMocks();
  });

  test('renders the scheduler with the correct title', () => {
    render(<DailyScheduler />);
    expect(screen.getByText(/today schedule/i)).toBeInTheDocument();
  });

  test('renders all time slots', () => {
    render(<DailyScheduler />);
    const hours = ['8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM'];
    hours.forEach(hour => {
      expect(screen.getByText(hour)).toBeInTheDocument();
    });
  });

  test('loads events from localStorage on initial render', () => {
    const eventKey = 'event_9:00_AM';
    const eventText = 'Morning meeting';
    
    store[eventKey] = eventText;
    
    render(<DailyScheduler />);
    expect(screen.getByText(eventText)).toBeInTheDocument();
  });

  test('saves an event to localStorage when the user types in a time slot', () => {
    render(<DailyScheduler />);
    
    const timeLabel = screen.getByText('9:00 AM');
    const slotContainer = timeLabel.closest('div'); 
    const inputSlot = slotContainer.querySelector('[contenteditable="true"]');
    
    fireEvent.input(inputSlot, { target: { textContent: 'Team Standup' } });
    fireEvent.blur(inputSlot);

    expect(localStorage.setItem).toHaveBeenCalledWith('event_9:00_AM', 'Team Standup');
    expect(store['event_9:00_AM']).toBe('Team Standup');
  });
});