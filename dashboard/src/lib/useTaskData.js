import { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { database } from "../firebase";
import { normalizeTask } from "../constants/task";

export function useTaskData(user) {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) return undefined;

    return onValue(
      ref(database, `users/${user.uid}/tasks`),
      (snapshot) => {
        const data = snapshot.val();
        setTasks(
          data
            ? Object.entries(data).map(([key, value]) => normalizeTask(key, value))
            : []
        );
        setIsLoading(false);
      },
      (err) => {
        setError(err?.message || "Failed to load tasks");
        setIsLoading(false);
      }
    );
  }, [user]);

  return { tasks, isLoading, error, setError };
}
