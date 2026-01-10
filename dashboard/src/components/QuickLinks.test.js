import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import QuickLinks from './QuickLinks';
import { database } from '../firebase';

jest.mock('firebase/database', () => ({
  getDatabase: jest.fn(() => ({})),
  ref: jest.fn(() => ({
    _path: { pieces_: [] },
    root: { _path: { pieces_: [] } },
  })),
  onValue: jest.fn(() => () => {}),
  set: jest.fn(() => Promise.resolve()),
}));

jest.mock('../firebase', () => {
  const mockRef = {
    _path: { pieces_: [] },
    root: { _path: { pieces_: [] } },
  };
  return {
    database: {
      _checkNotDeleted: jest.fn(),
      ref: jest.fn(() => mockRef),
      onValue: jest.fn(() => () => {}),
      set: jest.fn(() => Promise.resolve()),
    },
  };
});

describe('QuickLinks', () => {
  const user = { uid: 'test-user' };
  const mockData = [
    { title: 'Discord', url: 'https://discord.com' },
    { title: 'GitHub', url: 'https://github.com' }
  ];

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    
    database.onValue.mockImplementation((ref, callback) => {
      callback({ val: () => mockData });
      return () => {}; 
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('renders links from firebase', () => {
    render(<QuickLinks user={user} />);
    expect(screen.getByText('Discord')).toBeInTheDocument();
    expect(screen.getByText('GitHub')).toBeInTheDocument();
  });

  test('enters and leaves edit mode', () => {
    render(<QuickLinks user={user} />);
    fireEvent.click(screen.getByTitle('Edit Links'));
    expect(screen.getAllByLabelText('Title')[0]).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Done Editing'));
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
  });

  test('adds a new link in edit mode', () => {
    render(<QuickLinks user={user} />);
    fireEvent.click(screen.getByTitle('Edit Links'));
    fireEvent.click(screen.getByText('Add Link'));
    const titleInputs = screen.getAllByLabelText('Title');
    expect(titleInputs.length).toBe(3);
    fireEvent.change(titleInputs[2], { target: { value: 'New Link' } });
    fireEvent.click(screen.getByTitle('Done Editing'));
    expect(screen.getByText('New Link')).toBeInTheDocument();
  });

  test('edits an existing link and shows saving indicator', () => {
    render(<QuickLinks user={user} />);
    fireEvent.click(screen.getByTitle('Edit Links'));
    const firstTitleInput = screen.getAllByLabelText('Title')[0];
    fireEvent.change(firstTitleInput, { target: { value: 'My Discord' } });
    expect(screen.getByText('Saving...')).toBeInTheDocument();
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(database.set).toHaveBeenCalled();
    expect(screen.queryByText('Saving...')).not.toBeInTheDocument();
  });

  test('deletes a link', () => {
    render(<QuickLinks user={user} />);
    fireEvent.click(screen.getByTitle('Edit Links'));
    const firstLinkInputs = screen.getAllByLabelText('Title');
    const deleteButton = firstLinkInputs[0].closest('.group').querySelector('button');
    fireEvent.click(deleteButton);
    expect(screen.queryByText('Discord')).not.toBeInTheDocument();
  });
});