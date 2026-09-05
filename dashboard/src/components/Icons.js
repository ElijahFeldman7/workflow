import React from "react";

// Shared icon paths. These were duplicated across the work list, the class
// manager and the calendar; keeping one copy means the pencil and the bin
// always look the same wherever they appear.

const Icon = ({ path, className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d={path}
    />
  </svg>
);

const PATHS = {
  pencil:
    "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z",
  trash:
    "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",
  archive:
    "M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4",
  chevronLeft: "M15 19l-7-7 7-7",
  chevronRight: "M9 5l7 7-7 7",
  funnel: "M3 4h18l-7 8v6l-4 2v-8L3 4z",
  calendar:
    "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  check: "M5 13l4 4L19 7",
};

export const PencilIcon = (props) => <Icon path={PATHS.pencil} {...props} />;
export const TrashIcon = (props) => <Icon path={PATHS.trash} {...props} />;
export const ArchiveIcon = (props) => <Icon path={PATHS.archive} {...props} />;
export const ChevronLeftIcon = (props) => (
  <Icon path={PATHS.chevronLeft} {...props} />
);
export const ChevronRightIcon = (props) => (
  <Icon path={PATHS.chevronRight} {...props} />
);
export const FunnelIcon = (props) => <Icon path={PATHS.funnel} {...props} />;
export const CalendarIcon = (props) => <Icon path={PATHS.calendar} {...props} />;

/** A muted icon button, the shape used for row and header actions. */
export const IconButton = ({
  onClick,
  title,
  label,
  children,
  active = false,
  danger = false,
  className = "",
}) => (
  <button
    onClick={onClick}
    title={title}
    aria-label={label}
    className={`p-1 rounded transition-colors ${
      danger
        ? "text-muted-foreground hover:text-destructive hover:bg-muted"
        : active
        ? "text-foreground bg-muted"
        : "text-muted-foreground hover:text-foreground hover:bg-muted"
    } ${className}`}
  >
    {children}
  </button>
);
