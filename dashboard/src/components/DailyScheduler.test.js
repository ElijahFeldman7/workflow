import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DailyScheduler from './DailyScheduler';

describe('DailyScheduler', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('renders the scheduler with a title', () => {
    render(<DailyScheduler />);
    expect(screen.getByRole('heading', { name: /schedule/i })).toBeInTheDocument();
  });

  test('renders time slots', () => {
    render(<DailyScheduler />);
    expect(screen.getByText(/9:00 AM/i)).toBeInTheDocument();
    expect(screen.getByText(/12:00 PM/i)).toBeInTheDocument();
  });

  test('loads events from localStorage on initial render', () => {
    const eventText = 'Morning meeting';
    const eventKey = 'event_9:00_AM';
    localStorage.setItem(eventKey, eventText);
    
    render(<DailyScheduler />);
    
    const timeSlot = screen.getByLabelText(/Event for 9:00 AM/i);
    expect(timeSlot).toHaveTextContent(eventText);
  });

  test('saves an event to localStorage when the user types in a time slot', async () => {
    render(<DailyScheduler />);
    
    const timeSlot = screen.getByLabelText(/Event for 9:00 AM/i);
    
    await userEvent.clear(timeSlot);
    await userEvent.type(timeSlot, 'Team Standup');
    fireEvent.blur(timeSlot);

    expect(localStorage.getItem('event_9:00_AM')).toBe('Team Standup');
  });

  test('allows user to add and persist an event', async () => {
    render(<DailyScheduler />);
    
    const timeSlot = screen.getByLabelText(/Event for 9:00 AM/i);
    
    await userEvent.clear(timeSlot);
    await userEvent.type(timeSlot, 'Team Standup');
    fireEvent.blur(timeSlot);
    
    await waitFor(() => {
      expect(screen.getByText('Team Standup')).toBeInTheDocument();
    });
    
    const savedData = Object.values(localStorage).find(val => 
      val.includes('Team Standup')
    );
    expect(savedData).toBeTruthy();
  });

  test('persisted events survive page refresh', async () => {
    const { unmount } = render(<DailyScheduler />);
    
    const timeSlot = screen.getByLabelText(/Event for 9:00 AM/i);
    
    await userEvent.clear(timeSlot);
    await userEvent.type(timeSlot, 'Team Standup');
    fireEvent.blur(timeSlot);
    
    await waitFor(() => {
      expect(screen.getByText('Team Standup')).toBeInTheDocument();
    });
    
    unmount();
    render(<DailyScheduler />);
    
    expect(screen.getByText('Team Standup')).toBeInTheDocument();
  });
});