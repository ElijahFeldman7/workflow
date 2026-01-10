import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';
import { onAuthStateChanged } from 'firebase/auth';
import { logout } from './firebase';

jest.mock('firebase/auth', () => ({
  ...jest.requireActual('firebase/auth'),
  onAuthStateChanged: jest.fn(),
}));

jest.mock('./firebase', () => ({
  auth: {
    currentUser: {
      displayName: 'Test User',
      email: 'test@example.com',
      photoURL: 'https://example.com/avatar.png',
    },
  },
  logout: jest.fn(),
  signInWithGoogle: jest.fn(),
}));

jest.mock('./components/TaskManager', () => () => <div data-testid="task-manager">TaskManager</div>);
jest.mock('./components/KnowledgeBase', () => () => <div data-testid="knowledge-base">KnowledgeBase</div>);
jest.mock('./components/HabitTracker', () => () => <div data-testid="habit-tracker">HabitTracker</div>);
jest.mock('./components/QuickLinks', () => () => <div data-testid="quick-links">QuickLinks</div>);
jest.mock('./components/DailyScheduler', () => () => <div data-testid="daily-scheduler">DailyScheduler</div>);
jest.mock('./components/FocusTimer', () => () => <div data-testid="focus-timer">FocusTimer</div>);


describe('App component', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders loading state initially', () => {
    onAuthStateChanged.mockImplementation((auth, callback) => {
      return () => {};
    });

    render(<App />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  test('renders sign-in page when user is not authenticated', async () => {
    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(null);
      return () => {};
    });

    render(<App />);
    await waitFor(() => {
        expect(screen.getByText('Sign in with Google')).toBeInTheDocument();
    });
  });

  describe('when user is authenticated', () => {
    const mockUser = {
      displayName: 'Test User',
      email: 'test@example.com',
      photoURL: 'https://example.com/avatar.png',
    };

    beforeEach(() => {
      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser);
        return () => {};
      });
    });

    test('renders the main application', async () => {
      render(<App />);
      await waitFor(() => {
        expect(screen.getByText('Workflow')).toBeInTheDocument();
      });
      expect(screen.getByText('Tasks')).toBeInTheDocument();
    });

    test('renders TaskManager by default', async () => {
        render(<App />);
        await waitFor(() => {
          expect(screen.getByTestId('task-manager')).toBeInTheDocument();
        });
        expect(screen.getByText('Tasks')).toHaveClass('bg-blue-50 text-blue-700');
      });

      test('switches tabs when clicking navigation items', async () => {
        render(<App />);
        await waitFor(() => {
          expect(screen.getByTestId('task-manager')).toBeInTheDocument();
        });
  
        fireEvent.click(screen.getByText('Knowledge'));
        await waitFor(() => {
            expect(screen.getByTestId('knowledge-base')).toBeInTheDocument();
        });
        expect(screen.getByText('Knowledge')).toHaveClass('bg-blue-50 text-blue-700');
        expect(screen.getByText('Tasks')).not.toHaveClass('bg-blue-50 text-blue-700');

        fireEvent.click(screen.getByText('Schedule'));
        await waitFor(() => {
            expect(screen.getByTestId('daily-scheduler')).toBeInTheDocument();
        });
        expect(screen.getByText('Schedule')).toHaveClass('bg-blue-50 text-blue-700');
        expect(screen.getByText('Knowledge')).not.toHaveClass('bg-blue-50 text-blue-700');

        fireEvent.click(screen.getByText('Focus'));
        await waitFor(() => {
            expect(screen.getByTestId('focus-timer')).toBeInTheDocument();
        });
        expect(screen.getByText('Focus')).toHaveClass('bg-blue-50 text-blue-700');
        expect(screen.getByText('Schedule')).not.toHaveClass('bg-blue-50 text-blue-700');

        fireEvent.click(screen.getByText('Habits'));
        await waitFor(() => {
            expect(screen.getByTestId('habit-tracker')).toBeInTheDocument();
        });
        expect(screen.getByText('Habits')).toHaveClass('bg-blue-50 text-blue-700');
        expect(screen.getByText('Focus')).not.toHaveClass('bg-blue-50 text-blue-700');
  
        fireEvent.click(screen.getByText('Links'));
        await waitFor(() => {
            expect(screen.getByTestId('quick-links')).toBeInTheDocument();
        });
        expect(screen.getByText('Links')).toHaveClass('bg-blue-50 text-blue-700');
        expect(screen.getByText('Habits')).not.toHaveClass('bg-blue-50 text-blue-700');
      });

      test('logs out when sign out button is clicked', async () => {
        render(<App />);
        
        await waitFor(() => {
          expect(screen.getByText('Test User')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Test User'));

        await waitFor(() => {
            expect(screen.getByText('Sign out')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Sign out'));

        expect(logout).toHaveBeenCalledTimes(1);
      });

      test('unsubscribes from auth state changes on unmount', () => {
        const unsubscribe = jest.fn();
        onAuthStateChanged.mockReturnValue(unsubscribe);
    
        const { unmount } = render(<App />);
        unmount();
    
        expect(unsubscribe).toHaveBeenCalledTimes(1);
      });

      test('displays user email in dropdown', async () => {
        render(<App />);
        await waitFor(() => {
          expect(screen.getByText('Test User')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Test User'));

        await waitFor(() => {
            expect(screen.getByText(mockUser.email)).toBeInTheDocument();
        });
      });

      test('clicking logo switches to tasks tab', async () => {
        render(<App />);
        await waitFor(() => {
            expect(screen.getByTestId('task-manager')).toBeInTheDocument();
        });

        // First switch to another tab
        fireEvent.click(screen.getByText('Knowledge'));
        await waitFor(() => {
            expect(screen.getByTestId('knowledge-base')).toBeInTheDocument();
        });
        expect(screen.getByText('Knowledge')).toHaveClass('bg-blue-50 text-blue-700');


        // Then click the logo
        fireEvent.click(screen.getByAltText('Workflow Logo'));
        await waitFor(() => {
            expect(screen.getByTestId('task-manager')).toBeInTheDocument();
        });
        expect(screen.getByText('Tasks')).toHaveClass('bg-blue-50 text-blue-700');
        expect(screen.getByText('Knowledge')).not.toHaveClass('bg-blue-50 text-blue-700');
      });

      test('navItems array is correctly structured', () => {
        const expectedNavItems = [
            { id: 'tasks', label: 'Tasks' },
            { id: 'notes', label: 'Knowledge' },
            { id: 'scheduler', label: 'Schedule' },
            { id: 'focus', label: 'Focus' },
            { id: 'habits', label: 'Habits' },
            { id: 'links', label: 'Links' },
        ];
    
        render(<App />);
    
        const navButtons = screen.getAllByRole('button');
        const renderedNavItems = navButtons
            .map(button => button.textContent)
            .filter(label => expectedNavItems.some(item => item.label === label));

        expect(renderedNavItems).toHaveLength(expectedNavItems.length);
    
        expectedNavItems.forEach(item => {
            expect(screen.getByText(item.label)).toBeInTheDocument();
        });
      });
  });
});