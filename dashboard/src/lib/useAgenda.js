import { useMemo } from "react";

export const SOURCES = [
  { id: "work", label: "Work" },
  { id: "task", label: "Tasks" },
  { id: "google", label: "Calendar" },
];

export function mergeAgenda(items, tasks, visible, googleEvents = []) {
  const showWork = !visible || visible.includes("work");
  const showTasks = !visible || visible.includes("task");
  const showGoogle = !visible || visible.includes("google");

  const merged = [];
  // Rows the old two-way sync left in the work list. The cache below is the
  // only place Google's events come from now.
  if (showWork)
    items
      .filter((item) => item.origin !== "google")
      .forEach((item) => merged.push({ ...item, source: "work" }));
  if (showTasks)
    tasks.forEach((task) =>
      merged.push({ ...task, id: `task:${task.id}`, taskId: task.id, source: "task" })
    );
  // Read-only context from Google. These are not rows anyone owns here, so
  // they carry a source the calendar uses to render them plainly and to keep
  // them out of anything that edits.
  if (showGoogle)
    googleEvents.forEach((event) => merged.push({ ...event, source: "google" }));

  return merged;
}

/**
 * Agenda entries come from two lists with two sets of writes. This sends each
 * call to the right one, and gives a task entry its own id back first.
 */
export function routedWrites(workWrites, taskWrites) {
  const routed = (entry) =>
    entry.source === "task"
      ? { writes: taskWrites, target: { ...entry, id: entry.taskId } }
      : { writes: workWrites, target: entry };

  const send = (name) => (entry, ...rest) => {
    const { writes, target } = routed(entry);
    return writes[name](target, ...rest);
  };

  return {
    isDone: send("isDone"),
    toggleDone: send("toggleDone"),
    patch: send("patch"),
    deleteItem: send("deleteItem"),
  };
}

export function useAgenda(items, tasks, visible, googleEvents) {
  return useMemo(
    () => mergeAgenda(items, tasks, visible, googleEvents),
    [items, tasks, visible, googleEvents]
  );
}
