import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import KnowledgeBase from './KnowledgeBase';
import { database } from '../firebase';

// 1. FIX: Ensure all Firebase functions return a Promise
jest.mock('../firebase', () => {
    const mockRef = {
        _path: { pieces_: [] },
        root: { _path: { pieces_: [] } }
    };
    
    // Returning Promise.resolve() prevents the ".catch()" crash
    const push = jest.fn(() => ({ ...mockRef, key: 'new-note-id' }));
    const set = jest.fn(() => Promise.resolve());
    const update = jest.fn(() => Promise.resolve());
    const remove = jest.fn(() => Promise.resolve());
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
      notes.forEach(note => { data[note.id] = note; });
      callback({ val: () => data });
      return jest.fn(); 
    });
  });

  afterEach(() => {
    act(() => {
        jest.runOnlyPendingTimers(); 
    });
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

  test('creates a new note', async () => {
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

  test('edits a note and shows saving indicator', async () => {
    render(<KnowledgeBase user={user} />);
    openSidebar();
    
    fireEvent.click(screen.getByText('Note 1'));

    fireEvent.change(screen.getByLabelText('Note title'), { target: { value: 'Updated Title' } });

    expect(screen.getByText(/saving/i)).toBeInTheDocument();
    
    act(() => {
        jest.advanceTimersByTime(1000);
    });

    expect(database.update).toHaveBeenCalled();
    expect(screen.queryByText(/saving/i)).not.toBeInTheDocument();
  });

  test('deletes a note', async () => {
    render(<KnowledgeBase user={user} />);
    openSidebar();
    
    const deleteButtons = screen.getAllByLabelText(/delete note/i);
    fireEvent.click(deleteButtons[0]);

    expect(database.remove).toHaveBeenCalled();
  });
});