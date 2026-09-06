export const PALETTE = {
  rose: {
    label: "Rose",
    swatch: "bg-rose-500",
    dot: "bg-rose-500",
    chip: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
    bar: "border-l-rose-500",
    soft: "bg-rose-50 dark:bg-rose-900/20",
  },
  orange: {
    label: "Orange",
    swatch: "bg-orange-500",
    dot: "bg-orange-500",
    chip: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
    bar: "border-l-orange-500",
    soft: "bg-orange-50 dark:bg-orange-900/20",
  },
  amber: {
    label: "Amber",
    swatch: "bg-amber-500",
    dot: "bg-amber-500",
    chip: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    bar: "border-l-amber-500",
    soft: "bg-amber-50 dark:bg-amber-900/20",
  },
  lime: {
    label: "Lime",
    swatch: "bg-lime-500",
    dot: "bg-lime-500",
    chip: "bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-300",
    bar: "border-l-lime-500",
    soft: "bg-lime-50 dark:bg-lime-900/20",
  },
  emerald: {
    label: "Emerald",
    swatch: "bg-emerald-500",
    dot: "bg-emerald-500",
    chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    bar: "border-l-emerald-500",
    soft: "bg-emerald-50 dark:bg-emerald-900/20",
  },
  teal: {
    label: "Teal",
    swatch: "bg-teal-500",
    dot: "bg-teal-500",
    chip: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
    bar: "border-l-teal-500",
    soft: "bg-teal-50 dark:bg-teal-900/20",
  },
  sky: {
    label: "Sky",
    swatch: "bg-sky-500",
    dot: "bg-sky-500",
    chip: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
    bar: "border-l-sky-500",
    soft: "bg-sky-50 dark:bg-sky-900/20",
  },
  blue: {
    label: "Blue",
    swatch: "bg-blue-500",
    dot: "bg-blue-500",
    chip: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    bar: "border-l-blue-500",
    soft: "bg-blue-50 dark:bg-blue-900/20",
  },
  indigo: {
    label: "Indigo",
    swatch: "bg-indigo-500",
    dot: "bg-indigo-500",
    chip: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
    bar: "border-l-indigo-500",
    soft: "bg-indigo-50 dark:bg-indigo-900/20",
  },
  violet: {
    label: "Violet",
    swatch: "bg-violet-500",
    dot: "bg-violet-500",
    chip: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
    bar: "border-l-violet-500",
    soft: "bg-violet-50 dark:bg-violet-900/20",
  },
  fuchsia: {
    label: "Fuchsia",
    swatch: "bg-fuchsia-500",
    dot: "bg-fuchsia-500",
    chip: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-300",
    bar: "border-l-fuchsia-500",
    soft: "bg-fuchsia-50 dark:bg-fuchsia-900/20",
  },
  slate: {
    label: "Slate",
    swatch: "bg-slate-500",
    dot: "bg-slate-500",
    chip: "bg-slate-100 text-slate-800 dark:bg-slate-700/60 dark:text-slate-200",
    bar: "border-l-slate-500",
    soft: "bg-slate-50 dark:bg-slate-800/40",
  },
};

export const PALETTE_ENTRIES = Object.entries(PALETTE);
export const PALETTE_KEYS = PALETTE_ENTRIES.map(([key]) => key);
export const DEFAULT_COLOR = "blue";

const PALETTE_BY_KEY = new Map(PALETTE_ENTRIES);

export function colorOf(key) {
  return PALETTE_BY_KEY.get(key) || PALETTE_BY_KEY.get(DEFAULT_COLOR);
}

export const SPACE_KINDS = [
  { id: "class", label: "Class" },
  { id: "club", label: "Club" },
  { id: "personal", label: "Personal" },
];
export const SPACE_KIND_IDS = SPACE_KINDS.map((k) => k.id);
export const DEFAULT_SPACE_KIND = "class";

export const WORK_TYPES = [
  { id: "hw", label: "Homework" },
  { id: "quiz", label: "Quiz" },
  { id: "test", label: "Test" },
  { id: "lab", label: "Lab" },
  { id: "reading", label: "Reading" },
  { id: "project", label: "Project" },
  { id: "final", label: "Final" },
  { id: "seminar", label: "Seminar" },
  { id: "application", label: "Application" },
  { id: "other", label: "Other" },
];
export const WORK_TYPE_IDS = WORK_TYPES.map((t) => t.id);

export const DEFAULT_TYPE = "";

export const TYPE_CHIPS = {
  hw: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  quiz: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  test: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  lab: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
  reading: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  project: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  final: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  seminar: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  application: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  other: "bg-slate-100 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200",
};

export const NEUTRAL_CHIP =
  "bg-muted text-muted-foreground";

const TYPE_CHIP_BY_ID = new Map(Object.entries(TYPE_CHIPS));

export function typeChip(id) {
  return TYPE_CHIP_BY_ID.get(id) || TYPE_CHIPS.other;
}

export function typeLabel(id) {
  const found = WORK_TYPES.find((t) => t.id === id);
  return found ? found.label : "";
}

export const PRIORITIES = [
  {
    id: "low",
    label: "Low",
    weight: 1,
    chip: "bg-muted text-muted-foreground",
  },
  {
    id: "medium",
    label: "Medium",
    weight: 2,
    chip: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  },
  {
    id: "high",
    label: "High",
    weight: 4,
    chip: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  },
  {
    id: "insane",
    label: "INSANE",
    weight: 8,
    chip: "bg-red-600 text-white dark:bg-red-500 dark:text-white font-bold tracking-wide",
  },
];
export const PRIORITY_IDS = PRIORITIES.map((p) => p.id);
export const DEFAULT_PRIORITY = "medium";

export function priorityOf(id) {
  return PRIORITIES.find((p) => p.id === id) || PRIORITIES[1];
}

export const MODES = [
  { id: "due", label: "Due" },
  { id: "event", label: "Event" },
];
export const DEFAULT_MODE = "due";

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isDateKey(value) {
  return typeof value === "string" && DATE_KEY_RE.test(value);
}

export function isTimeValue(value) {
  return typeof value === "string" && TIME_RE.test(value);
}

export function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function fromDateKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function todayKey() {
  return toDateKey(new Date());
}

export function addDaysKey(key, days) {
  const date = fromDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function daysUntil(key, from = new Date()) {
  if (!isDateKey(key)) return null;
  const target = fromDateKey(key);
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((target - base) / MS_PER_DAY);
}

export function formatTime(value) {
  if (!isTimeValue(value)) return "";
  const [hour, minute] = value.split(":").map(Number);
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const ampm = hour >= 12 ? "PM" : "AM";
  return `${hour12}:${String(minute).padStart(2, "0")} ${ampm}`;
}

export function hourLabelFor(value) {
  if (!isTimeValue(value)) return "";
  const hour = Number(value.split(":")[0]);
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const ampm = hour >= 12 ? "PM" : "AM";
  return `${hour12}:00 ${ampm}`;
}

export function formatWhen(item) {
  const { date, time, endTime } = item.when;
  if (!date) return "No date";

  const diff = daysUntil(date);
  let day;
  if (diff === 0) day = "Today";
  else if (diff === 1) day = "Tomorrow";
  else if (diff === -1) day = "Yesterday";
  else if (diff > 1 && diff < 7)
    day = fromDateKey(date).toLocaleDateString("en-US", { weekday: "long" });
  else
    day = fromDateKey(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year:
        fromDateKey(date).getFullYear() === new Date().getFullYear()
          ? undefined
          : "numeric",
    });

  const start = formatTime(time);
  const end = formatTime(endTime);
  if (start && end) return `${day}, ${start}–${end}`;
  if (start) return `${day}, ${start}`;
  if (item.when.mode === "due" && diff !== null && diff < 0) {
    const late = Math.abs(diff);
    return `${day} (${late} day${late === 1 ? "" : "s"} late)`;
  }
  return day;
}

export const BUCKETS = [
  { id: "overdue", label: "Overdue", tone: "text-destructive" },
  { id: "today", label: "Today", tone: "text-primary" },
  { id: "tomorrow", label: "Tomorrow", tone: "" },
  { id: "later", label: "Later", tone: "" },
  { id: "someday", label: "No date", tone: "" },
  { id: "past", label: "Past", tone: "" },
];

export function bucketFor(item) {
  const diff = daysUntil(item.when.date);
  if (diff === null) return "someday";
  if (diff < 0) return item.when.mode === "event" ? "past" : "overdue";
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  return "later";
}

export function urgency(item) {
  const weight = priorityOf(item.priority).weight;
  const diff = daysUntil(item.when.date);
  if (diff === null) return weight * 0.1;
  return weight * (10 / (Math.max(diff, 0) + 1));
}

export function normalizeSpace(id, raw) {
  const data = raw || {};
  return {
    id,
    name: typeof data.name === "string" ? data.name : "Untitled",
    kind: SPACE_KIND_IDS.includes(data.kind) ? data.kind : DEFAULT_SPACE_KIND,
    color: Object.prototype.hasOwnProperty.call(PALETTE, data.color)
      ? data.color
      : DEFAULT_COLOR,
    teacher: typeof data.teacher === "string" ? data.teacher : "",
    room: typeof data.room === "string" ? data.room : "",
    archived: !!data.archived,
    order: Number.isFinite(data.order) ? data.order : 0,
    createdAt: Number(data.createdAt) || 0,
  };
}

export function normalizeItem(id, raw) {
  const data = raw || {};
  const when = data.when || {};
  return {
    id,
    title: typeof data.title === "string" ? data.title : "Untitled",
    spaceId: typeof data.spaceId === "string" ? data.spaceId : "",
    // "google" means the calendar sync made this row, so the work list leaves
    // it out. Rows written before this existed have no marker.
    origin: data.origin === "google" ? "google" : "workflow",
    type: WORK_TYPE_IDS.includes(data.type) ? data.type : "",
    priority: PRIORITY_IDS.includes(data.priority)
      ? data.priority
      : DEFAULT_PRIORITY,
    done: !!data.done,
    notes: typeof data.notes === "string" ? data.notes : "",
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

export function sortByDate(a, b) {
  if (!a.when.date && !b.when.date) return a.createdAt - b.createdAt;
  if (!a.when.date) return 1;
  if (!b.when.date) return -1;
  if (a.when.date !== b.when.date)
    return a.when.date < b.when.date ? -1 : 1;

  const aTime = a.when.time || "99:99";
  const bTime = b.when.time || "99:99";
  if (aTime !== bTime) return aTime < bTime ? -1 : 1;

  return priorityOf(b.priority).weight - priorityOf(a.priority).weight;
}

export function sortByUrgency(a, b) {
  return urgency(b) - urgency(a);
}
