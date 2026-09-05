import React from "react";

const Frame = ({ label, children }) => (
  <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/30">
      <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
      <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
      <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
      <span className="ml-2 text-xs text-muted-foreground">{label}</span>
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const Chip = ({ children, tone = "bg-muted text-muted-foreground" }) => (
  <span className={`text-[11px] px-2 py-0.5 rounded-full ${tone}`}>
    {children}
  </span>
);

const Box = ({ done }) => (
  <span
    className={`h-[18px] w-[18px] rounded-[5px] border flex-shrink-0 flex items-center justify-center ${
      done
        ? "bg-primary border-primary text-primary-foreground"
        : "border-muted-foreground/40"
    }`}
  >
    {done && (
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    )}
  </span>
);

export const MockCapture = () => (
  <Frame label="Add to work">
    <div className="rounded-md border border-border bg-background px-4 py-2.5 text-sm text-foreground">
      cell lab writeup for bio due friday
    </div>
    <div className="flex flex-wrap items-center gap-2 mt-3">
      <Chip tone="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
        AP Biology
      </Chip>
      <Chip>Lab</Chip>
      <Chip>Friday</Chip>
    </div>
    <p className="text-xs text-muted-foreground mt-4">
      One line in, four fields out. Nothing to click.
    </p>
  </Frame>
);

const ROWS = [
  { title: "Cell lab writeup", space: "AP Biology", type: "Lab", when: "Friday", done: false },
  { title: "Problem set 4", space: "Multivariable", type: "Homework", when: "Monday", done: false },
  { title: "Read chapter 7", space: "AP Biology", type: "Reading", when: "Sep 14", done: true },
];

export const MockWorkList = () => (
  <Frame label="Work">
    <p className="text-xs text-destructive mb-3">2 overdue</p>
    <ul className="divide-y divide-border">
      {ROWS.map((row) => (
        <li key={row.title} className="flex items-center justify-between gap-3 py-3">
          <span className="flex items-center gap-3 min-w-0">
            <Box done={row.done} />
            <span
              className={`text-sm truncate ${
                row.done ? "line-through text-muted-foreground" : "text-foreground"
              }`}
            >
              {row.title}
            </span>
          </span>
          <span className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
            <span>{row.space}</span>
            <span>{row.type}</span>
            <span>{row.when}</span>
          </span>
        </li>
      ))}
    </ul>
  </Frame>
);

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CELLS = [
  {}, { n: 1 }, { n: 2, dot: true }, { n: 3 }, { n: 4 }, { n: 5, today: true }, { n: 6 },
  { n: 7, chip: "Problem set" }, { n: 8 }, { n: 9, chip: "Activity fair" }, { n: 10 },
  { n: 11, chip: "Cell lab" }, { n: 12 }, { n: 13 },
];

export const MockCalendar = () => (
  <Frame label="Calendar">
    <div className="grid grid-cols-7 gap-px mb-px">
      {DAYS.map((day) => (
        <div key={day} className="text-[11px] text-muted-foreground text-center py-1">
          {day}
        </div>
      ))}
    </div>
    <div className="grid grid-cols-7 gap-px bg-border rounded overflow-hidden">
      {CELLS.map((cell, index) => (
        <div key={index} className="min-h-[3.5rem] bg-card p-1">
          {cell.n && (
            <div className="flex items-center justify-between">
              <span
                className={`text-[11px] w-5 h-5 flex items-center justify-center rounded-full ${
                  cell.today
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-foreground"
                }`}
              >
                {cell.n}
              </span>
              {cell.dot && <span className="h-1.5 w-1.5 rounded-full bg-destructive" />}
            </div>
          )}
          {cell.chip && (
            <div className="mt-1 text-[10px] leading-tight px-1 py-0.5 rounded bg-muted text-muted-foreground truncate">
              {cell.chip}
            </div>
          )}
        </div>
      ))}
    </div>
  </Frame>
);
