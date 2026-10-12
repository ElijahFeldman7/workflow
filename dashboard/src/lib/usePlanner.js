import { useCallback, useMemo } from "react";
import { useWorkData } from "./useWorkData";
import { useWorkWrites } from "./useWorkWrites";
import { useTaskData } from "./useTaskData";
import { useTaskWrites } from "./useTaskWrites";
import { useAgenda, routedWrites } from "./useAgenda";
import { useGoogleEvents } from "./googleEvents";
import { useRepeats } from "./useRepeats";
import { isRepeatInstance } from "./planner";

/**
 * Everything the planner reads and writes: work, to-dos and Google's events as
 * one list, and the handful of changes planning a day comes down to.
 *
 * @param dateKeys the days on screen, so repeating to-dos exist for them
 */
export function usePlanner(user, dateKeys) {
  const { activeSpaces, spaceById, items, isLoading, error, setError } =
    useWorkData(user);
  const {
    tasks,
    isLoading: tasksLoading,
    error: tasksError,
  } = useTaskData(user);
  const googleEvents = useGoogleEvents(user);

  const workWrites = useWorkWrites(user, activeSpaces, setError);
  const taskWrites = useTaskWrites(user, setError);
  const { isDone, toggleDone, patch, deleteItem } = routedWrites(
    workWrites,
    taskWrites
  );

  const shownTasks = useMemo(
    () => tasks.filter((task) => !task.skipped),
    [tasks]
  );
  const entries = useAgenda(items, shownTasks, undefined, googleEvents);

  const { repeatById, saveRepeat, stopRepeat } = useRepeats(user, {
    tasks,
    ready: !tasksLoading,
    dateKeys,
    onError: setError,
  });

  // The whole plan goes in each write: the database merges one level deep, so
  // a partial one would drop the fields it left out.
  const plan = (entry, changes) =>
    patch(entry, { plan: { ...entry.plan, ...changes } });

  const unplan = (entry) => patch(entry, { plan: null });

  const { addItem } = taskWrites;
  const addTodo = useCallback(
    (parsed, dateKey) => {
      // "practice 4-6pm" is a fixed thing on that day.
      if (parsed.mode === "event")
        return addItem({ ...parsed, date: parsed.date || dateKey });

      // "laundry 3pm" with no date means do it at three, not due at three.
      const timeIsPlan = !parsed.date && !!parsed.time;
      return addItem(timeIsPlan ? { ...parsed, time: "" } : parsed, {
        plan: {
          date: dateKey,
          time: timeIsPlan ? parsed.time : "",
          minutes: 0,
        },
      });
    },
    [addItem]
  );

  const deleteEntry = (entry) =>
    // Removing a repeat's to-do would only have the repeat make it again.
    isRepeatInstance(entry) ? patch(entry, { skipped: true }) : deleteItem(entry);

  return {
    spaceById,
    entries,
    isLoading: isLoading || tasksLoading,
    error: error || tasksError,
    isDone,
    toggleDone,
    patch,
    plan,
    unplan,
    addTodo,
    deleteEntry,
    repeatById,
    saveRepeat: (entry, weekdays) =>
      saveRepeat({ ...entry, id: entry.taskId }, weekdays),
    stopRepeat,
  };
}
