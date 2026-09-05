import React, { useState } from "react";
import {
  WORK_TYPES,
  PRIORITIES,
  MODES,
  NEUTRAL_CHIP,
  colorOf,
  formatWhen,
  priorityOf,
  typeLabel,
} from "../constants/work";

const CHIP = "text-[11px] px-2 py-0.5 rounded-full transition-colors";
const UNSURE = "border border-dashed border-muted-foreground/50 opacity-80";

const SURE_ENOUGH = 0.8;

const Chip = ({ label, className, sure, options, onPick, name }) => {
  const [open, setOpen] = useState(false);

  if (!options || options.length === 0) {
    return <span className={`${CHIP} ${className}`}>{label}</span>;
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={`${name}: ${label}. Click to correct.`}
        title={sure ? `${name}: ${label}` : `${name}: ${label} (unsure, click to fix)`}
        className={`${CHIP} ${className} ${sure ? "" : UNSURE} hover:ring-1 hover:ring-ring/50`}
      >
        {label}
      </button>

      {open && (
        <>
          <span
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <ul className="absolute left-0 top-full mt-1 z-20 w-44 max-h-56 overflow-y-auto bg-card border border-border rounded-md shadow-lg py-1">
            {options.map((option) => (
              <li key={option.value}>
                <button
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    setOpen(false);
                    onPick(option.value);
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {option.label}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </span>
  );
};

const CapturePreview = ({ parsed, spaces, colors, onCorrect }) => {
  const confidence = parsed.confidence || {};
  const sure = (field) => (confidence[field] || 0) >= SURE_ENOUGH;

  const space =
    spaces.find((item) => item.id === parsed.spaceId) ||
    (parsed.newSpaceName
      ? { name: parsed.newSpaceName, color: "slate", isNew: true }
      : null);

  const priority = priorityOf(parsed.priority);
  const idle = NEUTRAL_CHIP;

  const visible =
    !!space ||
    parsed.filled.type ||
    parsed.filled.priority ||
    parsed.filled.date ||
    parsed.mode === "event" ||
    !!parsed.location;

  if (!visible) return null;

  const spaceOptions = [
    { value: "", label: "No class" },
    ...spaces.map((item) => ({ value: item.id, label: item.name })),
  ];
  const typeOptions = [
    { value: "", label: "No type" },
    ...WORK_TYPES.map((type) => ({ value: type.id, label: type.label })),
  ];
  const priorityOptions = PRIORITIES.map((item) => ({
    value: item.id,
    label: item.label,
  }));
  const modeOptions = MODES.map((item) => ({
    value: item.id,
    label: item.id === "due" ? "Due date" : "Event",
  }));

  return (
    <div className="flex flex-wrap items-center gap-2 mt-2">
      {space && (
        <Chip
          name="Class"
          label={space.isNew ? `+ ${space.name}` : space.name}
          className={colors ? colorOf(space.color).chip : idle}
          sure={sure("space")}
          options={space.isNew ? null : spaceOptions}
          onPick={(value) => onCorrect("space", value)}
        />
      )}

      {parsed.filled.type && (
        <Chip
          name="Type"
          label={typeLabel(parsed.type)}
          className={idle}
          sure={sure("type")}
          options={typeOptions}
          onPick={(value) => onCorrect("type", value)}
        />
      )}

      {parsed.filled.priority && (
        <Chip
          name="Priority"
          label={priority.label}
          className={priority.chip}
          sure={sure("priority")}
          options={priorityOptions}
          onPick={(value) => onCorrect("priority", value)}
        />
      )}

      {parsed.filled.date && (
        <Chip
          name="When"
          label={formatWhen({ when: { ...parsed, mode: parsed.mode } })}
          className={idle}
          sure={sure("date")}
        />
      )}

      {parsed.mode === "event" && (
        <Chip
          name="Kind"
          label="Event"
          className={idle}
          sure={sure("mode")}
          options={modeOptions}
          onPick={(value) => onCorrect("mode", value)}
        />
      )}

      {parsed.location && (
        <Chip
          name="Where"
          label={`@ ${parsed.location}`}
          className={idle}
          sure={sure("location")}
        />
      )}
    </div>
  );
};

export default CapturePreview;
