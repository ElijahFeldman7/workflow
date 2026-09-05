import { toDateKey, fromDateKey, isTimeValue } from "../constants/work";

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function monthMatrix(year, month) {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());

  const weeks = [];
  const cursor = new Date(start);
  for (let week = 0; week < 6; week += 1) {
    const days = [];
    for (let day = 0; day < 7; day += 1) {
      days.push({
        key: toDateKey(cursor),
        dayOfMonth: cursor.getDate(),
        inMonth: cursor.getMonth() === month,
        isWeekend: cursor.getDay() === 0 || cursor.getDay() === 6,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(days);
  }
  return weeks;
}

export function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function addMonths(year, month, delta) {
  const date = new Date(year, month + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}

export function longDayLabel(key) {
  return fromDateKey(key).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function weekMatrix(key) {
  const date = fromDateKey(key);
  const sunday = new Date(date);
  sunday.setDate(sunday.getDate() - sunday.getDay());

  const days = [];
  for (let index = 0; index < 7; index += 1) {
    const day = new Date(sunday);
    day.setDate(day.getDate() + index);
    days.push({
      key: toDateKey(day),
      dayOfMonth: day.getDate(),
      weekday: WEEKDAY_LABELS[day.getDay()],
      isWeekend: day.getDay() === 0 || day.getDay() === 6,
    });
  }
  return days;
}

export function shiftWeek(key, delta) {
  const date = fromDateKey(key);
  date.setDate(date.getDate() + delta * 7);
  return toDateKey(date);
}

export function weekLabel(days) {
  const first = fromDateKey(days[0].key);
  const last = fromDateKey(days[6].key);
  const sameMonth = first.getMonth() === last.getMonth();

  const left = first.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const right = last.toLocaleDateString("en-US", {
    month: sameMonth ? undefined : "short",
    day: "numeric",
    year: first.getFullYear() === last.getFullYear() ? undefined : "numeric",
  });

  return `${left} – ${right}, ${last.getFullYear()}`;
}

export const minutesOf = (time) => {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
};

const DEFAULT_BLOCK_MINUTES = 60;
const MIN_BLOCK_MINUTES = 30;

export const isTimedBlock = (item) =>
  item.when.mode === "event" && isTimeValue(item.when.time);

export function layoutTimed(items) {
  const blocks = items
    .filter(isTimedBlock)
    .map((item) => {
      const start = minutesOf(item.when.time);
      const end = isTimeValue(item.when.endTime)
        ? Math.max(minutesOf(item.when.endTime), start + MIN_BLOCK_MINUTES)
        : start + DEFAULT_BLOCK_MINUTES;
      return { item, start, end, column: 0, columns: 1 };
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const laid = [];
  let cluster = [];
  let clusterEnd = -1;

  const flush = () => {
    if (cluster.length === 0) return;

    const columnEnds = [];
    cluster.forEach((block) => {
      let index = columnEnds.findIndex((end) => end <= block.start);
      if (index === -1) index = columnEnds.length;
      columnEnds[index] = block.end;
      block.column = index;
    });

    cluster.forEach((block) => {
      block.columns = columnEnds.length;
    });
    laid.push(...cluster);
    cluster = [];
    clusterEnd = -1;
  };

  blocks.forEach((block) => {
    if (cluster.length > 0 && block.start >= clusterEnd) flush();
    cluster.push(block);
    clusterEnd = Math.max(clusterEnd, block.end);
  });
  flush();

  return laid;
}

export function hourRange(blocks, fallbackStart = 8, fallbackEnd = 20) {
  let start = fallbackStart;
  let end = fallbackEnd;

  blocks.forEach((block) => {
    start = Math.min(start, Math.floor(block.start / 60));
    end = Math.max(end, Math.ceil(block.end / 60));
  });

  return { start: Math.max(0, start), end: Math.min(24, Math.max(end, start + 1)) };
}

export function byDate(items) {
  const map = new Map();
  items.forEach((item) => {
    if (!item.when.date) return;
    const list = map.get(item.when.date) || [];
    list.push(item);
    map.set(item.when.date, list);
  });
  map.forEach((list) =>
    list.sort((a, b) => (a.when.time || "99:99").localeCompare(b.when.time || "99:99"))
  );
  return map;
}
