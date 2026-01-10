import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import KnowledgeBase from './KnowledgeBase';
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
    const push = jest.fn(() => ({ ...mockRef, key: 'new-note-id' }));
    const set = jest.fn();
    const update = jest.fn();
    const remove = jest.fn();
    const onValue = jest.fn();
  
    return {
      database: {
        _checkNotDeleted: jest.fn(),
        ref: jest.fn(() => mockRef),
        push,
        set,
        update,
        remove,
        onValue,
      },
    };
  });

describe('KnowledgeBase', () => {
  const user = { uid: 'test-user' };
  const notes = [
    { id: 'note-1', title: 'Note 1', content: 'Content 1', updatedAt: Date.now() },
    { id: 'note-2', title: 'Note 2', content: 'Content 2', updatedAt: Date.now() - 1000 },
  ];

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();

    database.onValue.mockImplementation((ref, callback) => {
      const data = {};
      notes.forEach(note => {
        data[note.id] = note;
      });
      callback({ val: () => data });
      return jest.fn(); // Return a function for unsubscribe
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const openSidebar = () => {
    const toggleButton = screen.getByLabelText(/open sidebar/i);
    fireEvent.click(toggleButton);
  };

  test('renders and loads initial notes', () => {
    render(<KnowledgeBase user={user} />);
    openSidebar();
    
    expect(screen.getByText('My Notes')).toBeInTheDocument();
    expect(screen.getByText('Note 1')).toBeInTheDocument();
    expect(screen.getByText('Note 2')).toBeInTheDocument();
  });

  test('creates a new note', () => {
    render(<KnowledgeBase user={user} />);
    openSidebar();

    fireEvent.click(screen.getByLabelText('Create new note'));

    fireEvent.change(screen.getByLabelText('Note title'), { target: { value: 'New Test Note' } });
    fireEvent.change(screen.getByLabelText('Note content'), { target: { value: 'This is the content.' } });
    
    act(() => {
        jest.advanceTimersByTime(1000); 
    });

    expect(database.set).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        title: 'New Test Note',
        content: 'This is the content.'
    }));
  });

  test('edits a note and shows saving indicator', () => {
    render(<KnowledgeBase user={user} />);
    openSidebar();
    fireEvent.click(screen.getByText('Note 1'));

    fireEvent.change(screen.getByLabelText('Note title'), { target: { value: 'Updated Title' } });

    expect(screen.getByText('Saving...')).toBeInTheDocument();
    
    act(() => {
        jest.advanceTimersByTime(1000);
    });

    expect(database.update).toHaveBeenCalled();
    expect(screen.queryByText('Saving...')).not.toBeInTheDocument();
  });

  test('deletes a note', async () => {
    render(<KnowledgeBase user={user} />);
    openSidebar();
    
    const deleteButtons = screen.getAllByLabelText(/Delete note/i);
    fireEvent.click(deleteButtons[0]);

    expect(database.remove).toHaveBeenCalled();
  });

  test('toggles the sidebar', () => {
    render(<KnowledgeBase user={user} />);
    
    const toggleButton = screen.getByLabelText(/open sidebar/i);
    fireEvent.click(toggleButton);
    
    expect(screen.getByLabelText(/close sidebar/i)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/close sidebar/i));
    expect(screen.getByLabelText(/open sidebar/i)).toBeInTheDocument();
  });
});