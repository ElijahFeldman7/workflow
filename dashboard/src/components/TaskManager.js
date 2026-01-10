import React, { useState, useEffect } from 'react';
import { database } from '../firebase';
import { ref, onValue, push, set, child, remove, update } from "firebase/database";
import { gapi } from 'gapi-script';

const TaskManager = ({ user }) => {
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState('');
  const [taskDate, setTaskDate] = useState(''); // New state for the calendar date
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load tasks from Firebase
  useEffect(() => {
    if (!user) return;
    const tasksRef = ref(database, `users/${user.uid}/tasks`);
    const unsubscribe = onValue(
      tasksRef,
      (snapshot) => {
        const data = snapshot.val();
        const loadedTasks = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
        setTasks(loadedTasks);
        setIsLoading(false);
      },
      (err) => {
        setError(err?.message || 'Failed to load tasks');
        setIsLoading(false);
      }
    );
    return () => unsubscribe && unsubscribe();
  }, [user]);

  // Helper function: Sync to Google Calendar
  const addToGoogleCalendar = async (taskText, dateString) => {
    try {
      const event = {
        'summary': taskText,
        'description': 'Task created via Planora Workflow',
        'start': {
          'dateTime': `${dateString}:00`,
          'timeZone': Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        'end': {
          'dateTime': `${dateString}:59`, // Default to 1 hour event
          'timeZone': Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      };

      await gapi.client.calendar.events.insert({
        'calendarId': 'primary',
        'resource': event,
      });
      console.log('Successfully synced to Google Calendar');
    } catch (err) {
      console.error('Google Calendar Sync Error:', err);
      // We don't block the whole app if sync fails, just log it
    }
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (newTask.trim() === '' || !taskDate) {
      setError("Please provide both a task description and a date.");
      return;
    }

    try {
      // 1. Save to Firebase
      const newTaskRef = push(ref(database, `users/${user.uid}/tasks`));
      const taskData = {
        text: newTask,
        dueDate: taskDate,
        completed: false
      };
      await set(newTaskRef, taskData);

      // 2. Sync to Google Calendar
      await addToGoogleCalendar(newTask, taskDate);

      // Reset form
      setNewTask('');
      setTaskDate('');
      setError(null);
    } catch (err) {
      setError(err?.message || 'Failed to add task');
    }
  };

  const handleToggleTask = async (task) => {
    try {
      const taskRef = child(ref(database, `users/${user.uid}/tasks`), task.id);
      await update(taskRef, { completed: !task.completed });
    } catch (err) {
      setError(err?.message || 'Failed to update task');
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      const taskRef = child(ref(database, `users/${user.uid}/tasks`), taskId);
      await remove(taskRef);
    } catch (err) {
      setError(err?.message || 'Failed to delete task');
    }
  };

  return (
    <div className="bg-white shadow rounded-md p-6 max-w-4xl mx-auto">
      <div className="pb-4">
        <h2 className="text-xl font-semibold text-neutral-800">Tasks & Assignments</h2>
      </div>

      {/* Updated Form with Date Picker */}
      <form onSubmit={handleAddTask} className="flex flex-col gap-3 mb-6">
        <div className="flex flex-col md:flex-row gap-3">
          <input
            type="text"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="Add a new assignment..."
            required
            className="flex-grow border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <input 
            type="datetime-local"
            value={taskDate}
            onChange={(e) => setTaskDate(e.target.value)}
            required
            className="border border-gray-300 rounded-md px-4 py-2 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <button 
            type="submit" 
            className="bg-neutral-800 text-white px-5 py-2 rounded-md hover:bg-black transition-colors font-medium text-sm"
          >
            Add & Sync
          </button>
        </div>
      </form>

      {isLoading && (
        <div className="text-gray-500 text-center py-4">Fetching tasks...</div>
      )}

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4 text-sm">{error}</div>
      )}

      {!isLoading && !error && tasks.length === 0 && (
        <div className="text-gray-500 text-center py-8 bg-gray-50 rounded-md border border-dashed border-gray-300">
          No tasks yet. Add one above to see it on your calendar!
        </div>
      )}

      <ul className="divide-y divide-gray-100">
        {tasks.map(task => (
          <li key={task.id} className="group flex items-center justify-between py-3 hover:bg-gray-50 px-2 -mx-2 rounded transition-colors">
            <div className="flex items-center gap-3">
              <input 
                type="checkbox" 
                checked={!!task.completed} 
                onChange={() => handleToggleTask(task)} 
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer" 
              />
              <div className="flex flex-col">
                <span className={`text-gray-700 font-medium ${task.completed ? 'line-through text-gray-400' : ''}`}>
                  {task.text}
                </span>
                {task.dueDate && (
                  <span className="text-xs text-gray-500">
                    Due: {new Date(task.dueDate).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
            
            <button 
              onClick={() => handleDeleteTask(task.id)} 
              className="text-gray-400 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Delete task"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TaskManager;