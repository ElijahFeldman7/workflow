import React, { useState, useEffect } from 'react';
import { database } from '../firebase';
import { ref, onValue, push, set, child, remove, update } from "firebase/database";

const TaskManager = () => {
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState('');

  useEffect(() => {
    const tasksRef = ref(database, 'tasks');
    onValue(tasksRef, (snapshot) => {
      const data = snapshot.val();
      const loadedTasks = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
      setTasks(loadedTasks);
    });
  }, []);

  const handleAddTask = (e) => {
    e.preventDefault();
    if (newTask.trim() === '') return;

    const newTaskRef = push(ref(database, 'tasks'));
    set(newTaskRef, {
      text: newTask,
      completed: false
    });
    setNewTask('');
  };

  const handleToggleTask = (task) => {
    const taskRef = child(ref(database, 'tasks'), task.id);
    update(taskRef, { completed: !task.completed });
  };

  const handleDeleteTask = (taskId) => {
    const taskRef = child(ref(database, 'tasks'), taskId);
    remove(taskRef);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">my tasks</h2>
      <form onSubmit={handleAddTask} className="flex gap-2 mb-4">
        <input type="text" value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="Add a new task..." required className="flex-grow p-2 border rounded" />
        <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">add task</button>
      </form>
      <ul className="list-none p-0">
        {tasks.map(task => (
          <li key={task.id} className={`flex items-center p-2 border-b ${task.completed ? 'line-through text-gray-500' : ''}`}>
            <input type="checkbox" checked={task.completed} onChange={() => handleToggleTask(task)} className="mr-4 h-5 w-5" />
            <span>{task.text}</span>
            <button onClick={() => handleDeleteTask(task.id)} className="ml-auto bg-transparent border-none text-gray-400 hover:text-red-500 text-xl">&times;</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TaskManager;