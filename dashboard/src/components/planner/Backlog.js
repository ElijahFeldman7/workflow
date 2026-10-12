import React from "react";
import { DoneBox } from "../InlineFields";
import { colorOf } from "../../constants/work";
import { dragSource, dropTarget, dueLabel, shortDay } from "./shared";

const Backlog = ({
  groups,
  spaceById,
  colors,
  today,
  dayLabel,
  drag,
  onToggleDone,
  onPlan,
  onUnplan,
  onOpen,
}) => (
  <section
    aria-label="Backlog"
    className="bg-card shadow rounded-md p-4 transition-colors duration-200"
    {...dropTarget(drag, (entry) => entry.plan.date && onUnplan(entry))}
  >
    <h3 className="text-sm font-semibold text-foreground">To plan</h3>
    <p className="text-xs text-muted-foreground mb-3">
      Work and to-dos that are not planned here yet.
    </p>

    {groups.length === 0 && (
      <p className="text-sm text-muted-foreground py-6 text-center bg-muted/40 rounded-md border border-dashed border-border">
        nothing left to plan.
      </p>
    )}

    <div className="space-y-4 lg:max-h-[40rem] lg:overflow-y-auto">
      {groups.map((group) => (
        <div key={group.id}>
          <h4
            className={`text-[11px] uppercase tracking-wide mb-1 ${
              group.tone || "text-muted-foreground"
            }`}
          >
            {group.label}
          </h4>
          <ul className="space-y-0.5">
            {group.items.map((entry) => {
              const space = spaceById.get(entry.spaceId);
              return (
                <li
                  key={entry.id}
                  className="group flex items-center gap-2 rounded px-1.5 py-1 hover:bg-muted/50 cursor-grab"
                  {...dragSource(drag, entry)}
                >
                  <DoneBox
                    done={false}
                    onToggle={() => onToggleDone(entry)}
                    label={`Mark ${entry.title} as done`}
                  />
                  <button
                    onClick={() => onOpen(entry)}
                    aria-label={`Open ${entry.title}`}
                    className="min-w-0 flex-grow text-left"
                  >
                    <span className="block text-sm text-foreground truncate">
                      {entry.title}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground whitespace-nowrap">
                      {space && (
                        <span className="flex items-center gap-1 min-w-0">
                          <span
                            className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                              colors ? colorOf(space.color).dot : "bg-muted-foreground/50"
                            }`}
                          />
                          <span className="truncate">{space.name}</span>
                        </span>
                      )}
                      {entry.when.date && <span>{dueLabel(entry)}</span>}
                      {entry.plan.date && (
                        <span className="text-primary">
                          planned {shortDay(entry.plan.date, today)}
                        </span>
                      )}
                    </span>
                  </button>
                  <button
                    onClick={() => onPlan(entry)}
                    aria-label={`Plan ${entry.title} for ${dayLabel}`}
                    title={`Plan for ${dayLabel}`}
                    className="flex-shrink-0 h-6 w-6 rounded text-muted-foreground hover:bg-muted hover:text-foreground flex items-center justify-center"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m7-7H5" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  </section>
);

export default Backlog;
