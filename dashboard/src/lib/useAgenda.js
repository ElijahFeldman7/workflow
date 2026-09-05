import { useMemo } from "react";

export const SOURCES = [
  { id: "work", label: "Work" },
  { id: "task", label: "Tasks" },
];

export function mergeAgenda(items, tasks, visible) {
  const showWork = !visible || visible.includes("work");
  const showTasks = !visible || visible.includes("task");

  const merged = [];
  if (showWork)
    items.forEach((item) => merged.push({ ...item, source: "work" }));
  if (showTasks)
    tasks.forEach((task) =>
      merged.push({ ...task, id: `task:${task.id}`, taskId: task.id, source: "task" })
    );

  return merged;
}

export function useAgenda(items, tasks, visible) {
  return useMemo(() => mergeAgenda(items, tasks, visible), [items, tasks, visible]);
}
