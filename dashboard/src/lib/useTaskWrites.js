import { useCallback, useState } from "react";
import { ref, push, set, update, remove, child } from "firebase/database";
import { database } from "../firebase";
import { taskRecord } from "../constants/task";

export function useTaskWrites(user, onError) {
  const [pending, setPending] = useState(() => new Map());
  const tasksPath = user ? `users/${user.uid}/tasks` : null;

  const fail = useCallback(
    (err, fallback) => {
      if (onError) onError(err?.message || fallback);
    },
    [onError]
  );

  const patch = useCallback(
    async (task, changes) => {
      if (!user) return false;
      try {
        await update(child(ref(database, tasksPath), task.id), changes);
        return true;
      } catch (err) {
        fail(err, "Failed to save");
        return false;
      }
    },
    [user, tasksPath, fail]
  );

  const isDone = useCallback(
    (task) => (pending.has(task.id) ? pending.get(task.id) : task.done),
    [pending]
  );

  const toggleDone = useCallback(
    async (task) => {
      const next = !(pending.has(task.id) ? pending.get(task.id) : task.done);
      setPending((prev) => new Map(prev).set(task.id, next));

      const saved = await patch(task, {
        done: next,
        completedAt: next ? Date.now() : 0,
      });

      if (!saved) {
        setPending((prev) => {
          const rest = new Map(prev);
          rest.delete(task.id);
          return rest;
        });
      }
    },
    [pending, patch]
  );

  const deleteItem = useCallback(
    async (task) => {
      if (!user) return;
      try {
        await remove(child(ref(database, tasksPath), task.id));
      } catch (err) {
        fail(err, "Failed to delete task");
      }
    },
    [user, tasksPath, fail]
  );

  const addItem = useCallback(
    async (parsed) => {
      if (!user || parsed.title.trim() === "") return;
      try {
        await set(push(ref(database, tasksPath)), taskRecord(parsed));
      } catch (err) {
        fail(err, "Failed to add task");
      }
    },
    [user, tasksPath, fail]
  );

  return { patch, isDone, toggleDone, deleteItem, addItem };
}
