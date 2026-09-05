import { makeSpan } from "../spans";
import { words } from "../tokenize";

const pad = (value) => String(value).padStart(2, "0");
const clock = (hour, minute) => `${pad(hour)}:${pad(minute)}`;

export function parseClock(text) {
  const value = String(text || "").trim();
  if (value === "noon") return "12:00";
  if (value === "midnight") return "00:00";

  const match = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i.exec(value);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3] ? match[3].toLowerCase() : "";

  if (minute > 59) return null;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === "pm" && hour !== 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
  } else {
    if (!match[2] || hour > 23) return null;
  }

  return clock(hour, minute);
}

export function parseTimeToken(text) {
  const value = String(text || "").trim().toLowerCase();
  if (!value) return null;

  const range = /^(.+?)\s*(?:-|–|to|until|till)\s*(.+)$/.exec(value);
  if (range) {
    const right = parseClock(range[2]);
    if (!right) return null;
    let left = parseClock(range[1]);
    if (!left && /(am|pm)$/.test(range[2])) {
      left = parseClock(`${range[1]}${range[2].slice(-2)}`);
    }
    if (!left) return null;
    return { time: left, endTime: right, isRange: true };
  }

  const single = parseClock(value);
  return single ? { time: single, endTime: "", isRange: false } : null;
}

function spokenTime(list) {
  if (list.length !== 3) return null;
  const [first, second, third] = list;
  const hour = Number(third);
  if (!Number.isInteger(hour) || hour < 1 || hour > 12) return null;

  if (first === "half" && second === "past") return clock(hour, 30);
  if (first === "quarter" && second === "past") return clock(hour, 15);
  if (first === "quarter" && second === "to")
    return clock(hour === 1 ? 12 : hour - 1, 45);
  return null;
}

const LEADING = new Set(["from", "at", "starting", "starts"]);

export function findTimes(tokens) {
  const found = [];

  for (let from = 0; from < tokens.length; from += 1) {
    for (let size = 4; size >= 1; size -= 1) {
      const to = from + size - 1;
      if (to >= tokens.length) continue;

      const list = words(tokens, from, to);
      if (list.some((word) => word === "")) continue;

      const spoken = spokenTime(list);
      if (spoken) {
        found.push(makeSpan("time", spoken, from, to, 0.93));
        break;
      }

      const trimmed = LEADING.has(list[0]) ? list.slice(1) : list;
      if (trimmed.length === 0) continue;

      const joined = trimmed.join(" ");
      const parsed = parseTimeToken(joined);
      if (!parsed) continue;

      found.push(
        makeSpan("time", parsed.time, from, to, 0.95, {
          endTime: parsed.endTime,
          isRange: parsed.isRange,
        })
      );
      break;
    }
  }

  return found;
}

const DURATION_RE = /^(\d+(?:\.\d+)?)(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)$/;

export function findDurations(tokens) {
  const found = [];

  for (let from = 0; from < tokens.length; from += 1) {
    for (let size = 3; size >= 1; size -= 1) {
      const to = from + size - 1;
      if (to >= tokens.length) continue;

      const list = words(tokens, from, to);
      const trimmed = list[0] === "for" ? list.slice(1) : list;
      if (trimmed.length === 0 || trimmed.length > 2) continue;

      const joined = trimmed.join("");
      const match = DURATION_RE.exec(joined);
      if (!match) continue;

      const amount = Number(match[1]);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      const minutes = /^(h|hr|hrs|hour|hours)$/.test(match[2])
        ? Math.round(amount * 60)
        : Math.round(amount);
      if (minutes <= 0 || minutes > 24 * 60) continue;

      found.push(
        makeSpan("duration", minutes, from, to, list[0] === "for" ? 0.9 : 0.6)
      );
      break;
    }
  }

  return found;
}

export function addMinutes(time, minutes) {
  const [hour, minute] = time.split(":").map(Number);
  const total = (hour * 60 + minute + minutes) % (24 * 60);
  return clock(Math.floor(total / 60), total % 60);
}
