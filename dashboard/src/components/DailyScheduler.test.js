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

  test('allows user to add and persist an event', async () => {
    render(<DailyScheduler />);
    
    const timeSlot = screen.getByLabelText(/Event for 9:00 AM/i);
    
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