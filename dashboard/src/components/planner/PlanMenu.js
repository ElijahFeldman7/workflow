import React, { useEffect, useState } from "react";
import { DoneBox } from "../InlineFields";
import { TrashIcon } from "../Icons";
import { WEEKDAY_LABELS } from "../../lib/calendar";
import { LENGTHS, isFixed, planMinutes } from "../../lib/planner";
import { addDaysKey } from "../../constants/work";
import { dueLabel, shortDay } from "./shared";

const field =
  "rounded-md border border-border bg-background text-foreground px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring dark:[color-scheme:dark]";

const pill = (on) =>
  `px-2.5 py-1 rounded text-xs transition-colors ${
    on
      ? "bg-primary text-primary-foreground"
      : "bg-muted text-foreground hover:bg-muted/70"
  }`;

const Row = ({ label, children }) => (
  <div className="flex items-start gap-3 py-2">
    <span className="w-14 flex-shrink-0 pt-1 text-xs text-muted-foreground">
      {label}
    </span>
    <div className="flex flex-wrap items-center gap-1.5 min-w-0">{children}</div>
  </div>
);

// Everything dragging does, by tapping instead: which day, what time, how
// long. It is the way to plan on a phone, and with a keyboard.
const PlanMenu = ({
  entry,
  today,
  selected,
  done,
  repeat,
  onToggleDone,
  onRename,
  onPlan,
  onUnplan,
  onWhen,
  onRepeat,
  onStopRepeat,
  onDelete,
  onClose,
}) => {
  const [title, setTitle] = useState(entry.title);
  useEffect(() => setTitle(entry.title), [entry.title]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const fixed = isFixed(entry);
  const isTodo = entry.source === "task";
  const tomorrow = addDaysKey(today, 1);
  const day = entry.plan.date;
  const weekdays = repeat ? repeat.weekdays : [];

  const commitTitle = () => {
    const next = title.trim();
    if (next && next !== entry.title) onRename(next);
    else setTitle(entry.title);
  };

  const toggleWeekday = (index) =>
    onRepeat(
      weekdays.includes(index)
        ? weekdays.filter((value) => value !== index)
        : [...weekdays, index].sort()
    );

  return (
    <div
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Plan ${entry.title}`}
        onClick={(event) => event.stopPropagation()}
        className="w-full sm:max-w-md bg-card text-foreground rounded-t-lg sm:rounded-lg shadow-lg p-4"
      >
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          {!fixed && (
            <DoneBox
              done={done}
              onToggle={onToggleDone}
              label={`Mark ${entry.title} as ${done ? "not done" : "done"}`}
            />
          )}
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={commitTitle}
            onKeyDown={(event) => event.key === "Enter" && event.target.blur()}
            aria-label="Title"
            className="min-w-0 flex-grow bg-transparent text-base font-medium focus:outline-none focus:ring-2 focus:ring-ring rounded px-1"
          />
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex-shrink-0 h-7 w-7 rounded text-muted-foreground hover:bg-muted flex items-center justify-center"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {entry.when.date && !fixed && (
          <p className="pt-2 text-xs text-muted-foreground">{dueLabel(entry)}</p>
        )}

        {fixed ? (
          <>
            <Row label="Day">
              <input
                type="date"
                aria-label="Day"
                value={entry.when.date}
                onChange={(event) =>
                  event.target.value && onWhen({ date: event.target.value })
                }
                className={field}
              />
            </Row>
            <Row label="Time">
              <input
                type="time"
                aria-label="Starts"
                value={entry.when.time}
                onChange={(event) => onWhen({ time: event.target.value })}
                className={field}
              />
              <span className="text-xs text-muted-foreground">to</span>
              <input
                type="time"
                aria-label="Ends"
                value={entry.when.endTime}
                onChange={(event) => onWhen({ endTime: event.target.value })}
                className={field}
              />
            </Row>
          </>
        ) : (
          <>
            <Row label="Day">
              <button
                onClick={() => onPlan({ date: today })}
                aria-pressed={day === today}
                className={pill(day === today)}
              >
                Today
              </button>
              <button
                onClick={() => onPlan({ date: tomorrow })}
                aria-pressed={day === tomorrow}
                className={pill(day === tomorrow)}
              >
                Tomorrow
              </button>
              {selected !== today && selected !== tomorrow && (
                <button
                  onClick={() => onPlan({ date: selected })}
                  aria-pressed={day === selected}
                  className={pill(day === selected)}
                >
                  {shortDay(selected, today)}
                </button>
              )}
              <input
                type="date"
                aria-label="Plan for another day"
                value={day}
                onChange={(event) =>
                  event.target.value && onPlan({ date: event.target.value })
                }
                className={field}
              />
            </Row>

            <Row label="Start">
              <input
                type="time"
                aria-label="Start time"
                value={entry.plan.time}
                step={900}
                onChange={(event) =>
                  onPlan({
                    date: day || selected,
                    time: event.target.value,
                    minutes: planMinutes(entry),
                  })
                }
                className={field}
              />
              {entry.plan.time && (
                <button
                  onClick={() => onPlan({ time: "" })}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  no time
                </button>
              )}
            </Row>

            <Row label="Length">
              {LENGTHS.map((minutes) => (
                <button
                  key={minutes}
                  onClick={() => onPlan({ date: day || selected, minutes })}
                  aria-pressed={planMinutes(entry) === minutes}
                  aria-label={`${minutes} minutes`}
                  className={pill(planMinutes(entry) === minutes)}
                >
                  {minutes < 60 ? `${minutes}m` : `${minutes / 60}h`}
                </button>
              ))}
            </Row>

            {isTodo && (
              <Row label="Repeat">
                {WEEKDAY_LABELS.map((label, index) => (
                  <button
                    key={label}
                    onClick={() => toggleWeekday(index)}
                    aria-pressed={weekdays.includes(index)}
                    aria-label={`Repeat on ${label}`}
                    className={pill(weekdays.includes(index))}
                  >
                    {label.slice(0, 2)}
                  </button>
                ))}
                <button
                  onClick={() =>
                    weekdays.length === 7
                      ? onStopRepeat()
                      : onRepeat([0, 1, 2, 3, 4, 5, 6])
                  }
                  className="text-xs text-muted-foreground hover:text-foreground ml-1"
                >
                  {weekdays.length === 7 ? "stop" : "every day"}
                </button>
              </Row>
            )}
          </>
        )}

        <div className="flex items-center justify-between pt-3 mt-1 border-t border-border">
          {!fixed && day ? (
            <button
              onClick={onUnplan}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Take off {shortDay(day, today)}
            </button>
          ) : (
            <span />
          )}
          {isTodo && (
            <button
              onClick={onDelete}
              aria-label={`Delete ${entry.title}`}
              className="flex items-center gap-1 text-xs text-destructive hover:underline"
            >
              <TrashIcon className="w-3.5 h-3.5" />
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlanMenu;
