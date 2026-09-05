import {
  PRIORITY_IDS,
  DEFAULT_PRIORITY,
  isDateKey,
  isTimeValue,
} from "./work";

export function normalizeTask(id, raw) {
  const data = raw || {};
  const when = data.when || {};

  const title =
    typeof data.title === "string" && data.title !== ""
      ? data.title
      : typeof data.text === "string"
      ? data.text
      : "Untitled";

  const done =
    typeof data.done === "boolean" ? data.done : !!data.completed;

  return {
    id,
    title,
    done,
    priority: PRIORITY_IDS.includes(data.priority)
      ? data.priority
      : DEFAULT_PRIORITY,
    notes: typeof data.notes === "string" ? data.notes : "",
    spaceId: "",
    type: "",
    location: typeof data.location === "string" ? data.location : "",
    when: {
      mode: when.mode === "event" ? "event" : "due",
      date: isDateKey(when.date) ? when.date : "",
      time: isTimeValue(when.time) ? when.time : "",
      endTime: isTimeValue(when.endTime) ? when.endTime : "",
    },
    createdAt: Number(data.createdAt) || 0,
    completedAt: Number(data.completedAt) || 0,
  };
}

export function taskRecord(parsed) {
  return {
    title: parsed.title.trim(),
    priority: PRIORITY_IDS.includes(parsed.priority)
      ? parsed.priority
      : DEFAULT_PRIORITY,
    notes: "",
    location: parsed.location || "",
    when: {
      mode: parsed.mode === "event" ? "event" : "due",
      date: parsed.date || "",
      time: parsed.time || "",
      endTime: parsed.mode === "event" ? parsed.endTime || "" : "",
    },
    done: false,
    createdAt: Date.now(),
    completedAt: 0,
  };
}
