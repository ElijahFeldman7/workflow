import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import HabitTracker from './HabitTracker';
import { database } from '../firebase';

jest.mock('../firebase', () => {
  const mockRef = {
    _path: {
        pieces_: []
    },
    root: {
        _path: {
            pieces_: []
        }
    }
  };
  return {
    database: {
      _checkNotDeleted: jest.fn(),
      ref: jest.fn(() => mockRef),
      onValue: jest.fn(),
      update: jest.fn(),
      set: jest.fn(), // Added set for saveChanges
    },
  };
});

describe('HabitTracker', () => {
  const user = { uid: 'test-user' };
  const mockHabitData = {
    list: ['Workout', 'Read', 'Relax'],
    history: {}
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    database.onValue.mockImplementation((ref, callback) => {
      callback({
        val: () => mockHabitData,
      });
      return jest.fn(); // Return a function for unsubscribe
    });
  });

  test('renders habits and days of the week', () => {
    render(<HabitTracker user={user} />);
    
    mockHabitData.list.forEach(habit => {
      expect(screen.getByText(habit)).toBeInTheDocument();
    });

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    days.forEach(day => {
        expect(screen.queryAllByText(day).length).toBeGreaterThan(0);
    });
  });

  test('enters and exits edit mode', () => {
    render(<HabitTracker user={user} />);
    
    const editButton = screen.getByLabelText('Edit habits');
    fireEvent.click(editButton);

    expect(screen.getByText('Editing Mode')).toBeInTheDocument();
    
    const inputs = screen.getAllByPlaceholderText('Habit name...');
    expect(inputs[0]).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Editing Mode')).not.toBeInTheDocument();
  });

  test('adds, edits, and deletes a habit in edit mode', () => {
    render(<HabitTracker user={user} />);
    
    fireEvent.click(screen.getByLabelText('Edit habits'));

    fireEvent.click(screen.getByText('+ Add Habit'));
    let inputs = screen.getAllByLabelText(/Habit name for/i);
    fireEvent.change(inputs[inputs.length - 1], { target: { value: 'New Habit' } });

    fireEvent.change(inputs[0], { target: { value: 'Morning Workout' } });

    const deleteButtons = screen.getAllByLabelText(/Delete .* habit/i);
    fireEvent.click(deleteButtons[1]);

    fireEvent.click(screen.getByText('Save'));

    expect(database.set).toHaveBeenCalled();
  });

  test('shows and hides the yearly heatmap', () => {
    render(<HabitTracker user={user} />);
    
    fireEvent.click(screen.getByLabelText('Toggle yearly view'));
    expect(screen.getByText('Yearly Progress')).toBeInTheDocument();

    const closeButton = screen.getByLabelText('Close yearly progress view');
    fireEvent.click(closeButton);

    expect(screen.queryByText('Yearly Progress')).not.toBeInTheDocument();
  });
});