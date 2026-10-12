import React from "react";
import { DayChip } from "../InlineFields";
import { formatTime } from "../../constants/work";
import { dayEntries } from "../../lib/planner";
import { FIXED_TONE, chipTone, dragSource, dropTarget } from "./shared";

// The whole week side by side, for spreading work across it. Each day shows
// what is fixed and what is planned; dragging between days moves the plan.
const WeekBoard = ({
  days,
  entries,
  today,
  spaceById,
  colors,
  drag,
  isDone,
  onToggleDone,
  onPlanFor,
  onOpenDay,
  onOpen,
}) => (
  <div className="overflow-x-auto">
    <div className="grid grid-cols-7 gap-2 min-w-[44rem]">
      {days.map((day) => {
        const { fixed, timed, tray } = dayEntries(entries, day.key);
        const planned = [...timed, ...tray];

        return (
          <section
            key={day.key}
            aria-label={`${day.weekday} ${day.dayOfMonth}`}
            className={`rounded border border-border min-h-[14rem] flex flex-col ${
              day.isWeekend ? "bg-muted/20" : ""
            }`}
            {...dropTarget(drag, (entry) => onPlanFor(entry, day.key))}
          >
            <button
              onClick={() => onOpenDay(day.key)}
              aria-label={`Open ${day.weekday} ${day.dayOfMonth}`}
              className="py-1.5 text-center border-b border-border hover:bg-muted/40 transition-colors"
            >
              <div className="text-[11px] text-muted-foreground">{day.weekday}</div>
              <div
                className={`text-sm mx-auto w-6 h-6 flex items-center justify-center rounded-full ${
                  day.key === today
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-foreground"
                }`}
              >
                {day.dayOfMonth}
              </div>
            </button>

            <div className="p-1 space-y-0.5 flex-grow">
              {fixed.map((entry) => (
                <div
                  key={entry.id}
                  title={entry.title}
                  className={`px-1 py-0.5 rounded text-[11px] leading-snug line-clamp-2 ${FIXED_TONE}`}
                >
                  {entry.when.time && (
                    <span className="opacity-70 mr-1">
                      {formatTime(entry.when.time)}
                    </span>
                  )}
                  {entry.title}
                </div>
              ))}

              {planned.map((entry) => {
                const done = isDone(entry);
                return (
                  <div key={entry.id} className="cursor-grab" {...dragSource(drag, entry)}>
                    <DayChip
                      label={entry.title}
                      time={formatTime(entry.plan.time)}
                      done={done}
                      onToggle={() => onToggleDone(entry)}
                      onSelect={() => onOpen(entry)}
                      className={chipTone(entry, { spaceById, colors, done })}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  </div>
);

export default WeekBoard;
