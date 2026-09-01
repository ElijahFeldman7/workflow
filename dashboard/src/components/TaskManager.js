import React, { useState, useEffect } from "react";
import { database } from "../firebase";
import {
  ref,
  onValue,
  push,
  set,
  child,
  remove,
  update,
} from "firebase/database";

const TaskManager = ({ user }) => {
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) return;
    const tasksRef = ref(database, `users/${user.uid}/tasks`);
    const unsubscribe = onValue(
      tasksRef,
      (snapshot) => {
        const data = snapshot.val();
        const loadedTasks = data
          ? Object.keys(data).map((key) => ({ id: key, ...data[key] }))
          : [];
        setTasks(loadedTasks);
        setIsLoading(false);
      },
      (err) => {
        setError(err?.message || "Failed to load tasks");
        setIsLoading(false);
      }
    );
    return () => unsubscribe && unsubscribe();
  }, [user]);

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (newTask.trim() === "") return;

    try {
      const newTaskRef = push(ref(database, `users/${user.uid}/tasks`));
      await set(newTaskRef, {
        text: newTask,
        completed: false,
      });
      setNewTask("");
    } catch (err) {
      setError(err?.message || "Failed to add task");
    }
  };

  const handleToggleTask = async (task) => {
    try {
      const taskRef = child(ref(database, `users/${user.uid}/tasks`), task.id);
      await update(taskRef, { completed: !task.completed });
    } catch (err) {
      setError(err?.message || "Failed to update task");
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      const taskRef = child(ref(database, `users/${user.uid}/tasks`), taskId);
      await remove(taskRef);
    } catch (err) {
      setError(err?.message || "Failed to delete task");
    }
  };

  return (
    <div className="bg-card shadow rounded-md p-6 max-w-4xl mx-auto transition-colors duration-200">
      <div className="pb-4">
        <h2 className="text-xl font-semibold text-foreground">
          tasks
        </h2>
      </div>

      <form onSubmit={handleAddTask} className="flex gap-3 mb-6">
        <input
          type="text"
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          placeholder="add a task"
          required
          className="flex-grow border border-border rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-ring/40 bg-background text-foreground placeholder-muted-foreground"
          aria-label="New task"
        />
        <button
          type="submit"
          className="bg-primary text-primary-foreground px-5 py-2 rounded-md hover:bg-primary/90 transition-colors font-medium text-sm"
        >
          Add Task
        </button>
      </form>

      {isLoading && (
        <div className="text-muted-foreground text-center py-4">
          fetching tasks...
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 text-destructive p-3 rounded-md mb-4 text-sm">
          {error}
        </div>
      )}

      {!isLoading && !error && tasks.length === 0 && (
        <div className="text-muted-foreground text-center py-8 bg-muted/40 rounded-md border border-dashed border-border">
          no tasks yet.
        </div>
      )}

      <ul className="divide-y divide-border">
        {tasks.map((task) => (
          <li
            key={task.id}
            className="group flex items-center justify-between py-3 hover:bg-muted/40 px-2 -mx-2 rounded transition-colors"
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={!!task.completed}
                onChange={() => handleToggleTask(task)}
                className="h-4 w-4 text-primary focus:ring-ring border-border rounded cursor-pointer dark:bg-gray-700"
                aria-label={`Mark task ${task.text} as ${
                  task.completed ? "incomplete" : "complete"
                }`}
              />
              <span
                className={`text-foreground ${
                  task.completed
                    ? "line-through text-muted-foreground"
                    : ""
                }`}
              >
                {task.text}
              </span>
            </div>

            <button
              onClick={() => handleDeleteTask(task.id)}
              className="text-gray-400 hover:text-destructive p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Delete task"
              aria-label={`Delete task ${task.text}`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TaskManager;
