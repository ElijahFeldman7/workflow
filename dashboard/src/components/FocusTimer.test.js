import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import FocusTimer from './FocusTimer';
import { database } from '../firebase';

jest.mock('../firebase', () => {
    const mockRef = {
        _path: { pieces_: [] },
        root: { _path: { pieces_: [] } }
    };
    return {
        database: {
            _checkNotDeleted: jest.fn(),
            ref: jest.fn(() => mockRef),
            update: jest.fn(() => Promise.resolve()),
            onValue: jest.fn(() => jest.fn()), 
        },
    };
});

const mockPlay = jest.fn().mockResolvedValue();
global.Audio = jest.fn().mockImplementation(() => ({
    play: mockPlay,
    pause: jest.fn(),
    cloneNode: jest.fn().mockReturnThis(),
}));

Object.defineProperty(global, 'Notification', {
    value: {
        requestPermission: jest.fn().mockResolvedValue('granted'),
        permission: 'granted',
    },
    writable: true
});

describe('FocusTimer', () => {
    const user = { uid: 'test-user' };
  
    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
    });

    afterEach(() => {
        act(() => {
            jest.runOnlyPendingTimers();
        });
        jest.useRealTimers();
    });
  
    test('renders initial state correctly', () => {
        render(<FocusTimer user={user} />);
        
        expect(screen.getByText('25:00')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /start/i })).toBeInTheDocument();
        expect(screen.getByText(/get back to work/i)).toBeInTheDocument();
    });

    test('starts and pauses the timer', () => {
        render(<FocusTimer user={user} />);
        
        fireEvent.click(screen.getByRole('button', { name: /start/i }));
        
        act(() => {
            jest.advanceTimersByTime(1000);
        });
        
        expect(screen.getByText('24:59')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /pause/i }));
        
        act(() => {
            jest.advanceTimersByTime(1000);
        });

        expect(screen.getByText('24:59')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /start/i })).toBeInTheDocument();
    });

    test('switches to break mode when work timer completes', () => {
        render(<FocusTimer user={user} />);
        
        fireEvent.click(screen.getByRole('button', { name: /start/i }));
        
        act(() => {
            jest.advanceTimersByTime(25 * 60 * 1000);
        });
        
        expect(screen.getByText('05:00')).toBeInTheDocument();
        expect(screen.getByText(/be chill/i)).toBeInTheDocument();
    });

    test('opens and closes settings', () => {
        render(<FocusTimer user={user} />);
        
        const settingsButton = screen.getByRole('button', { name: /settings/i }) || 
                               screen.getByLabelText(/settings/i);
        
        fireEvent.click(settingsButton);
        
        expect(screen.getByText(/study time/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

        expect(screen.queryByText(/study time/i)).not.toBeInTheDocument();
    });

    test('updates timer durations from settings', async () => {
        render(<FocusTimer user={user} />);
        
        const settingsButton = screen.getByRole('button', { name: /settings/i }) || 
                               screen.getByLabelText(/settings/i);
        fireEvent.click(settingsButton);
        
        const workInput = screen.getByLabelText(/work/i);
        const breakInput = screen.getByLabelText(/break/i);

        fireEvent.change(workInput, { target: { value: '30' } });
        fireEvent.change(breakInput, { target: { value: '10' } });

        fireEvent.click(screen.getByRole('button', { name: /save/i }));

        expect(screen.getByText('30:00')).toBeInTheDocument();
    });
});