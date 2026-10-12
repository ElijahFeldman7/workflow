import {
  NEUTRAL_CHIP,
  addDaysKey,
  colorOf,
  formatTime,
  formatWhen,
  fromDateKey,
  priorityOf,
} from "../../constants/work";
import { timeOfMinutes } from "../../lib/planner";

export const PX_PER_MINUTE = 0.9;

export function chipTone(entry, { spaceById, colors, done }) {
  const space = spaceById.get(entry.spaceId);
  if (done) return "bg-muted text-muted-foreground line-through";
  if (space && colors) return colorOf(space.color).chip;
  if (entry.priority === "insane") return priorityOf("insane").chip;
  return NEUTRAL_CHIP;
}

// Google's events and your own fixed ones: there to plan around, not to move.
export const FIXED_TONE =
  "bg-muted/70 text-muted-foreground border border-dashed border-border";

export function shortDay(key, today) {
  if (key === today) return "today";
  if (key === addDaysKey(today, 1)) return "tomorrow";
  if (key === addDaysKey(today, -1)) return "yesterday";
  return fromDateKey(key).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export const dueLabel = (entry) =>
  entry.when.date ? `due ${formatWhen(entry)}` : "";

export const spanLabel = (start, end) =>
  `${formatTime(timeOfMinutes(start))}–${formatTime(timeOfMinutes(end))}`;

/**
 * What makes a row something you can pick up. The entry rides in a ref, since
 * a drop target cannot read the dragged data until the drop itself.
 */
export function dragSource(drag, entry) {
  return {
    draggable: true,
    onDragStart: (event) => {
      const top = event.currentTarget.getBoundingClientRect().top;
      drag.current = { entry, grab: (event.clientY || top) - top };
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", entry.id);
      }
    },
    onDragEnd: () => {
      drag.current = null;
    },
  };
}

export function dropTarget(drag, onDrop) {
  return {
    onDragOver: (event) => {
      if (drag.current) event.preventDefault();
    },
    onDrop: (event) => {
      if (!drag.current) return;
      event.preventDefault();
      const held = drag.current;
      drag.current = null;
      onDrop(held.entry, event, held.grab);
    },
  };
}
