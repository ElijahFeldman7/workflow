import React, { useMemo, useState } from "react";
import QuickAdd from "./QuickAdd";
import WorkList from "./WorkList";
import { useTaskData } from "../lib/useTaskData";
import { useTaskWrites } from "../lib/useTaskWrites";
import { useWorkPrefs } from "../lib/workPrefs";
import { useCaptureMemory } from "../lib/useCaptureMemory";
import { BUCKETS, bucketFor, sortByDate } from "../constants/work";

const DONE_VISIBLE = 8;

const TaskManager = ({ user }) => {
  const { tasks, isLoading, error, setError } = useTaskData(user);
  const [prefs] = useWorkPrefs();
  const { memory, learn } = useCaptureMemory(user);
  const { patch, isDone, toggleDone, deleteItem, addItem } = useTaskWrites(
    user,
    setError
  );

  const [expandedId, setExpandedId] = useState(null);
  const [showAllDone, setShowAllDone] = useState(false);

  const visible = useMemo(
    () =>
      tasks.filter(
        (task) => prefs.showPast || isDone(task) || bucketFor(task) !== "past"
      ),
    [tasks, prefs.showPast, isDone]
  );

  const groups = useMemo(() => {
    const byBucket = new Map();
    visible.forEach((task) => {
      const bucket = isDone(task) ? "done" : bucketFor(task);
      const list = byBucket.get(bucket) || [];
      list.push(task);
      byBucket.set(bucket, list);
    });

    const ordered = [];
    BUCKETS.forEach((bucket) => {
      const list = byBucket.get(bucket.id);
      if (list && list.length)
        ordered.push({
          ...bucket,
          collapsible: bucket.id === "past",
          items: [...list].sort(
            bucket.id === "past" ? (a, b) => sortByDate(b, a) : sortByDate
          ),
        });
    });

    const done = byBucket.get("done");
    if (done && done.length) {
      const sorted = [...done].sort((a, b) => b.completedAt - a.completedAt);
      ordered.push({
        id: "done",
        label: "Done",
        tone: "",
        items: showAllDone ? sorted : sorted.slice(0, DONE_VISIBLE),
        hidden: showAllDone ? 0 : Math.max(0, sorted.length - DONE_VISIBLE),
      });
    }

    return ordered;
  }, [visible, isDone, showAllDone]);

  const doneCount = useMemo(() => visible.filter(isDone).length, [visible, isDone]);
  const openCount = visible.length - doneCount;

  const doneFooter = doneCount > DONE_VISIBLE && (
    <button
      onClick={() => setShowAllDone(!showAllDone)}
      className="mt-4 text-xs text-muted-foreground hover:text-foreground"
    >
      {showAllDone ? "collapse done" : `show all ${doneCount} done`}
    </button>
  );

  return (
    <div className="max-w-4xl mx-auto bg-card shadow rounded-md p-6 transition-colors duration-200">
      <div className="flex items-center justify-between pb-4">
        <h2 className="text-xl font-semibold text-foreground">tasks</h2>
        {openCount > 0 && (
          <span className="text-sm text-muted-foreground">{openCount} open</span>
        )}
      </div>

      <QuickAdd
        spaces={[]}
        onSubmit={addItem}
        memory={memory}
        onLearn={learn}
        placeholder="call the dentist tomorrow 3pm"
      />

      {error && (
        <div className="bg-destructive/10 text-destructive p-3 rounded-md mt-4 text-sm">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="text-muted-foreground text-center py-6 text-sm">
          fetching tasks...
        </div>
      )}

      {!isLoading && visible.length === 0 && (
        <div className="text-muted-foreground text-center py-8 mt-4 bg-muted/40 rounded-md border border-dashed border-border text-sm">
          no tasks yet.
        </div>
      )}

      {!isLoading && visible.length > 0 && (
        <div className={prefs.table ? "mt-6" : "mt-2"}>
          <WorkList
            groups={groups}
            spaces={[]}
            spaceById={new Map()}
            prefs={{ ...prefs, table: false }}
            isDone={isDone}
            onToggleDone={toggleDone}
            onPatch={patch}
            onDelete={deleteItem}
            expandedId={expandedId}
            onExpand={setExpandedId}
            footer={doneFooter}
          />
        </div>
      )}
    </div>
  );
};

export default TaskManager;
