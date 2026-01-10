import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TaskManager from './TaskManager';

jest.mock('firebase/database', () => ({
  getDatabase: jest.fn(),
  ref: jest.fn((db, path) => ({ path })), 
  onValue: jest.fn(),
  push: jest.fn(() => ({ key: 'mock-key' })),
  set: jest.fn(() => Promise.resolve()),
  remove: jest.fn(() => Promise.resolve()),
  update: jest.fn(() => Promise.resolve()),
}));

import { ref, onValue, push, set, remove, update } from 'firebase/database';

describe('TaskManager', () => {
  const user = { uid: 'test-user' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('displays tasks once loaded', async () => {
    const tasks = {
      'task-1': { text: 'Task 1', completed: false },
    };
    
    onValue.mockImplementation((query, callback) => {
      callback({ val: () => tasks });
      return () => {};
    });

    render(<TaskManager user={user} />);

    await waitFor(() => {
      expect(screen.getByText('Task 1')).toBeInTheDocument();
    });
  });

  test('adds a new task', async () => {
    render(<TaskManager user={user} />);
    
    const input = screen.getByPlaceholderText('add a task');
    const addButton = screen.getByText('Add Task');

    fireEvent.change(input, { target: { value: 'A new task' } });
    fireEvent.click(addButton);

    await waitFor(() => {
        expect(set).toHaveBeenCalled();
    });
  });
});