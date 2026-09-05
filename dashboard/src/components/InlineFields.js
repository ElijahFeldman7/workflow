import React, { useState, useRef, useEffect } from "react";

const HIT = "rounded px-1.5 py-0.5 -mx-1.5 text-left";

export const InlineText = ({ value, onChange, className = "", label }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== value) onChange(next);
    else setDraft(value);
  };

  if (!editing) {
    return (
      <button
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        className={`${HIT} w-full truncate hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-ring/40 ${className}`}
        title="Click to rename"
      >
        {value}
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") {
          setDraft(value);
          setEditing(false);
        }
      }}
      aria-label={label}
      className={`${HIT} w-full bg-background border border-border focus:outline-none focus:ring-2 focus:ring-ring/40 ${className}`}
    />
  );
};

export const InlineDate = ({ value, display, onChange, className = "", label }) => {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!editing) return;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    if (typeof input.showPicker === "function") {
      try {
        input.showPicker();
      } catch (e) {
      }
    }
  }, [editing]);

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className={`${HIT} whitespace-nowrap hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-ring/40 ${
          display ? className : "text-muted-foreground/60"
        }`}
        title="Click to change the date"
      >
        {display || "—"}
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => setEditing(false)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === "Escape") setEditing(false);
      }}
      aria-label={label}
      className={`${HIT} bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 dark:[color-scheme:dark]`}
    />
  );
};

export const DoneBox = ({ done, onToggle, label, small = false }) => (
  <button
    onClick={onToggle}
    role="checkbox"
    aria-checked={done}
    aria-label={label}
    className={`flex-shrink-0 border flex items-center justify-center transition-colors ${
      small ? "h-3 w-3 rounded-[3px]" : "h-[18px] w-[18px] rounded-[5px]"
    } ${
      done
        ? "bg-primary border-primary text-primary-foreground"
        : "border-muted-foreground/40 hover:border-primary hover:bg-primary/10"
    }`}
  >
    <svg
      className={`${small ? "w-2 h-2" : "w-3 h-3"} ${
        done ? "opacity-100" : "opacity-0"
      }`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={small ? 4 : 3}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  </button>
);

export const DayChip = ({
  label,
  time,
  done,
  onToggle,
  onSelect,
  className = "",
}) => (
  <div
    className={`flex items-start gap-1 px-1 py-0.5 rounded text-[11px] leading-snug ${className}`}
    title={label}
  >
    {onToggle && (
      <DoneBox
        small
        done={done}
        onToggle={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        label={`Mark ${label} as ${done ? "not done" : "done"}`}
      />
    )}
    <button
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      className="min-w-0 flex-grow text-left break-words line-clamp-2"
      aria-label={`Open ${label}`}
    >
      {time && <span className="opacity-70 mr-1">{time}</span>}
      {label}
    </button>
  </div>
);

export const EventMark = () => (
  <span
    className="h-[18px] w-[18px] flex-shrink-0 flex items-center justify-center text-muted-foreground/50"
    title="Event"
  >
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  </span>
);

export const FilterChips = ({ options, active, onToggle }) => (
  <>
    {options.map((option) => {
      const on = active.includes(option.value);
      return (
        <button
          key={option.value}
          onClick={() => onToggle(option.value)}
          aria-pressed={on}
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs transition-colors ${
            on
              ? option.className || "bg-muted text-foreground"
              : "text-muted-foreground hover:bg-muted/60"
          }`}
        >
          {option.dot && (
            <span className={`h-1.5 w-1.5 rounded-full ${option.dot}`} />
          )}
          {option.label}
        </button>
      );
    })}
  </>
);
