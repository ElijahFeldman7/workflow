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
  if (showWork)
    items.forEach((item) => merged.push({ ...item, source: "work" }));
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

export function useAgenda(items, tasks, visible, googleEvents) {
  return useMemo(
    () => mergeAgenda(items, tasks, visible, googleEvents),
    [items, tasks, visible, googleEvents]
  );
}
