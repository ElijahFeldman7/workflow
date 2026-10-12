import React, { useState } from "react";
import { shortDay } from "./shared";

// Planned for a day that has passed and not done. Offered, never moved for you.
const CarryOver = ({ entries, today, onMove, onDrop }) => {
  const [open, setOpen] = useState(false);
  if (entries.length === 0) return null;

  const link = "text-xs font-medium hover:underline";

  return (
    <div
      role="region"
      aria-label="Unfinished from earlier"
      className="bg-muted/40 border border-border rounded-md p-3 text-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <button
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="text-foreground text-left"
        >
          {entries.length} unfinished from earlier
          <span className="text-muted-foreground"> · {open ? "hide" : "show"}</span>
        </button>
        <div className="flex gap-4">
          <button
            onClick={() => entries.forEach((entry) => onMove(entry))}
            className={`${link} text-primary`}
          >
            Move all to today
          </button>
          <button
            onClick={() => entries.forEach((entry) => onDrop(entry))}
            className={`${link} text-muted-foreground`}
          >
            Drop all
          </button>
        </div>
      </div>

      {open && (
        <ul className="mt-2 space-y-1">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center gap-3">
              <span className="min-w-0 flex-grow truncate text-foreground">
                {entry.title}
                <span className="text-xs text-muted-foreground">
                  {" "}
                  · {shortDay(entry.plan.date, today)}
                </span>
              </span>
              <button
                onClick={() => onMove(entry)}
                aria-label={`Move ${entry.title} to today`}
                className={`${link} text-primary flex-shrink-0`}
              >
                Today
              </button>
              <button
                onClick={() => onDrop(entry)}
                aria-label={`Drop ${entry.title} from the plan`}
                className={`${link} text-muted-foreground flex-shrink-0`}
              >
                Drop
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CarryOver;
