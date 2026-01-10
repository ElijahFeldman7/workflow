import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import FocusTimer from './FocusTimer';
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
      update: jest.fn(),
      onValue: jest.fn(),
    },
  };
});

global.Audio = jest.fn().mockImplementation(() => ({
  play: jest.fn(),
}));
global.Notification = {
  requestPermission: jest.fn(),
  permission: 'granted',
};


describe('FocusTimer', () => {
    const user = { uid: 'test-user' };
  
    beforeEach(() => {
      jest.useFakeTimers();
      database.ref.mockClear();
      database.update.mockClear();
      database.onValue.mockClear();
      global.Audio.mockClear();
      global.Notification.requestPermission.mockClear();
    });

    afterEach(() => {
        jest.useRealTimers();
    });
  
    test('renders initial state correctly', () => {
      render(<FocusTimer user={user} />);
      
      expect(screen.getByText('25:00')).toBeInTheDocument();
      expect(screen.getByText('Start')).toBeInTheDocument();
      expect(screen.getByText('get back to work!')).toBeInTheDocument();
    });

    test('starts and pauses the timer', () => {
        render(<FocusTimer user={user} />);
        
        fireEvent.click(screen.getByText('Start'));
        
        act(() => {
            jest.advanceTimersByTime(1000);
        });
        
        expect(screen.getByText('24:59')).toBeInTheDocument();
        expect(screen.getByText('Pause')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Pause'));
        
        act(() => {
            jest.advanceTimersByTime(1000);
        });

        expect(screen.getByText('24:59')).toBeInTheDocument();
        expect(screen.getByText('Start')).toBeInTheDocument();
      });

    test('resets the timer', () => {
        render(<FocusTimer user={user} />);
        
        fireEvent.click(screen.getByText('Start'));
        
        act(() => {
            jest.advanceTimersByTime(5000);
        });

        expect(screen.getByText('24:55')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Reset'));

        expect(screen.getByText('25:00')).toBeInTheDocument();
        expect(screen.getByText('Start')).toBeInTheDocument();
    });

    test('switches to break mode when work timer completes', () => {
        render(<FocusTimer user={user} />);
        
        fireEvent.click(screen.getByText('Start'));
        
        act(() => {
          jest.advanceTimersByTime(25 * 60 * 1000);
        });
        
        expect(screen.getByText('05:00')).toBeInTheDocument();
        expect(screen.getByText('be chill')).toBeInTheDocument();
        expect(screen.getByText('Start')).toBeInTheDocument();
      });

      test('opens and closes settings', () => {
        render(<FocusTimer user={user} />);
        
        const settingsButton = screen.getByRole('button', { name: /M10.325/i });
        fireEvent.click(settingsButton);
        
        expect(screen.getByText('Study Time')).toBeInTheDocument();
        expect(screen.getByText('Save')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Cancel'));

        expect(screen.queryByText('Study Time')).not.toBeInTheDocument();
      });

      test('updates timer durations from settings', () => {
        render(<FocusTimer user={user} />);
        
        const settingsButton = screen.getByRole('button', { name: /M10.325/i });
        fireEvent.click(settingsButton);
        
        const workInput = screen.getByLabelText('Work (min)');
        const breakInput = screen.getByLabelText('Break (min)');

        fireEvent.change(workInput, { target: { value: '30' } });
        fireEvent.change(breakInput, { target: { value: '10' } });

        fireEvent.click(screen.getByText('Save'));

        expect(screen.getByText('30:00')).toBeInTheDocument();
      });
  });
