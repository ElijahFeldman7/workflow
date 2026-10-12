import React from "react";
import QuickAdd from "../QuickAdd";
import { DoneBox } from "../InlineFields";
import { formatTime } from "../../constants/work";
import { planMinutes } from "../../lib/planner";
import { dragSource, dropTarget, dueLabel } from "./shared";

// The day's own list: what you said you would do, in no particular hour.
const DayTray = ({
  tray,
  timed,
  dayLabel,
  drag,
  isDone,
  onToggleDone,
  onAdd,
  onDropHere,
  onOpen,
  memory,
  onLearn,
}) => {
  const row = (entry) => {
    const done = isDone(entry);
    return (
      <li
        key={entry.id}
        className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-muted/50 cursor-grab"
        {...dragSource(drag, entry)}
      >
        <DoneBox
          done={done}
          onToggle={() => onToggleDone(entry)}
          label={`Mark ${entry.title} as ${done ? "not done" : "done"}`}
        />
        <button
          onClick={() => onOpen(entry)}
          aria-label={`Open ${entry.title}`}
          className="min-w-0 flex-grow text-left"
        >
          <span
            className={`block text-sm truncate ${
              done ? "text-muted-foreground line-through" : "text-foreground"
            }`}
          >
            {entry.title}
          </span>
          {(entry.plan.time || entry.when.date) && (
            <span className="flex gap-1.5 text-[11px] text-muted-foreground">
              {entry.plan.time && (
                <span>
                  {formatTime(entry.plan.time)} · {planMinutes(entry)} min
                </span>
              )}
              {entry.when.date && <span>{dueLabel(entry)}</span>}
            </span>
          )}
        </button>
      </li>
    );
  };

  return (
    <section
      aria-label="Planned for the day"
      className="min-w-0"
      {...dropTarget(drag, onDropHere)}
    >
      <QuickAdd
        spaces={[]}
        onSubmit={onAdd}
        memory={memory}
        onLearn={onLearn}
        placeholder={`add a to-do for ${dayLabel}`}
      />

      {tray.length === 0 && timed.length === 0 && (
        <p className="text-sm text-muted-foreground py-6 mt-3 text-center bg-muted/40 rounded-md border border-dashed border-border">
          nothing planned. add a to-do, or pull something in from the list.
        </p>
      )}

      {tray.length > 0 && (
        <>
          <h4 className="text-[11px] uppercase tracking-wide text-muted-foreground mt-4 mb-1">
            No time yet
          </h4>
          <ul className="space-y-0.5">{tray.map(row)}</ul>
        </>
      )}

      {timed.length > 0 && (
        <>
          <h4 className="text-[11px] uppercase tracking-wide text-muted-foreground mt-4 mb-1">
            On the clock
          </h4>
          <ul className="space-y-0.5">{timed.map(row)}</ul>
        </>
      )}
    </section>
  );
};

export default DayTray;
