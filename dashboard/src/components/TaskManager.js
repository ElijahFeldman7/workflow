import React, { useState, useEffect } from 'react';
import { database } from '../firebase';
import { ref, onValue, push, set, child, remove, update } from "firebase/database";

const TaskManager = () => {
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const tasksRef = ref(database, 'tasks');
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
  }, []);

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (newTask.trim() === '') return;

    try {
      const newTaskRef = push(ref(database, 'tasks'));
      await set(newTaskRef, {
        text: newTask,
        completed: false
      });
      setNewTask('');
    } catch (err) {
      setError(err?.message || 'Failed to add task');
    }
  };

  const handleToggleTask = async (task) => {
    try {
      const taskRef = child(ref(database, 'tasks'), task.id);
      await update(taskRef, { completed: !task.completed });
    } catch (err) {
      setError(err?.message || 'Failed to update task');
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      const taskRef = child(ref(database, 'tasks'), taskId);
      await remove(taskRef);
    } catch (err) {
      setError(err?.message || 'Failed to delete task');
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">my tasks</h2>

      <form onSubmit={handleAddTask} className="flex gap-2 mb-4">
        <input
          type="text"
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          placeholder="Add a new task..."
          required
          className="flex-grow p-2 border rounded"
        />
        <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">add task</button>
      </form>

      {isLoading && (
        <div className="text-gray-500">Loading tasks…</div>
      )}

      {error && (
        <div className="text-red-600 mb-2">{error}</div>
      )}

      {!isLoading && !error && tasks.length === 0 && (
        <div className="text-gray-500">No tasks yet. Add your first task above.</div>
      )}

      <ul className="list-none p-0">
        {tasks.map(task => (
          <li key={task.id} className={`flex items-center p-2 border-b ${task.completed ? 'line-through text-gray-500' : ''}`}>
            <input type="checkbox" checked={!!task.completed} onChange={() => handleToggleTask(task)} className="mr-4 h-5 w-5" />
            <span>{task.text}</span>
            <button onClick={() => handleDeleteTask(task.id)} className="ml-auto bg-transparent border-none text-gray-400 hover:text-red-500 text-xl">&times;</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TaskManager;