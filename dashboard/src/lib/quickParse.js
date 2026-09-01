// Parses a typed line into a work item.
//
// Two layers:
//   1. Sigils (#class /type @time *place !!!) match anywhere in the line.
//   2. Bare words (fri, quiz, insane, bio) match only as a SUFFIX — scanning
//      right to left, stopping at the first token that isn't vocabulary.
//
// The suffix rule keeps titles intact: "Read chapter 4 bio quiz fri" keeps
// "Read chapter 4" as the title even though "read" is a type alias.

import {
  WORK_TYPE_IDS,
  PRIORITY_IDS,
  DEFAULT_TYPE,
  DEFAULT_PRIORITY,
  DEFAULT_MODE,
  MS_PER_DAY,
  toDateKey,
} from "../constants/work";

const TYPE_ALIASES = {
  hw: "hw",
  homework: "hw",
  quiz: "quiz",
  test: "test",
  exam: "test",
  midterm: "test",
  lab: "lab",
  reading: "reading",
  read: "reading",
  project: "project",
  proj: "project",
  final: "final",
  finals: "final",
  seminar: "seminar",
  application: "application",
  app: "application",
  apply: "application",
  other: "other",
  misc: "other",
};

const PRIORITY_ALIASES = {
  low: "low",
  med: "medium",
  medium: "medium",
  high: "high",
  urgent: "high",
  insane: "insane",
};

const MODE_WORDS = { event: "event", meeting: "meeting", mtg: "meeting" };

// Words not worth leaving dangling once the fields behind them are stripped
// ("Study for bio test friday" -> "Study").
const TRAILING_STOPWORDS = new Set([
  "for",
  "on",
  "by",
  "at",
  "in",
  "due",
  "the",
  "a",
  "an",
  "-",
  ":",
  ",",
]);

const WEEKDAYS = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  weds: 3,
  wednesday: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
};

const MONTHS = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

const clean = (word) => word.toLowerCase().replace(/[.,;:!?]+$/, "");
const normalize = (text) => text.toLowerCase().replace(/[^a-z0-9]/g, "");

const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

/* ------------------------------- spaces ---------------------------------- */

// Ranked: exact, then prefix, then word-prefix ("comp" -> "Computer Team"),
// then initials, then subsequence. Ties break on name so results are stable.
export function matchSpaces(query, spaces, maxScore = 4) {
  const q = normalize(query);
  if (!q) return [];

  const scored = [];
  spaces.forEach((space) => {
    const full = normalize(space.name);
    const words = space.name.toLowerCase().split(/\s+/).map(normalize);
    const initials = normalize(
      space.name
        .split(/\s+/)
        .map((word) => word[0] || "")
        .join("")
    );

    let score = null;
    if (full === q) score = 0;
    else if (full.startsWith(q)) score = 1;
    else if (words.some((word) => word && word.startsWith(q))) score = 2;
    else if (initials === q) score = 3;
    else if (q.length >= 3 && isSubsequence(q, full)) score = 4;

    if (score !== null && score <= maxScore) scored.push({ space, score });
  });

  scored.sort(
    (a, b) => a.score - b.score || a.space.name.localeCompare(b.space.name)
  );
  return scored.map((entry) => entry.space);
}

function isSubsequence(needle, haystack) {
  let index = 0;
  for (const char of haystack) {
    if (char === needle[index]) index += 1;
    if (index === needle.length) return true;
  }
  return false;
}

/* -------------------------------- time ----------------------------------- */

function parseClock(text) {
  const match = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i.exec(String(text).trim());
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
    // A bare number is not a time — "3" stays in the title, "3:00" doesn't.
    if (!match[2] || hour > 23) return null;
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

// "3pm", "15:00", "3-5pm", "9am-12pm". A meridiem on the right carries left.
export function parseTimeToken(text) {
  const value = String(text || "").trim().toLowerCase();
  if (!value) return null;

  const range = /^(.+?)\s*(?:-|to)\s*(.+)$/.exec(value);
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

/* -------------------------------- dates ---------------------------------- */

const startOfDay = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

function upcomingWeekday(from, weekday) {
  const date = startOfDay(from);
  let delta = (weekday - date.getDay() + 7) % 7;
  if (delta === 0) delta = 7; // a bare weekday never means today
  date.setDate(date.getDate() + delta);
  return date;
}

function monthDay(month, day, now) {
  if (day < 1 || day > 31) return null;
  const date = new Date(now.getFullYear(), month, day);
  if (date.getMonth() !== month) return null;
  // More than six months back almost certainly means next year.
  if (startOfDay(now) - date > 182 * MS_PER_DAY)
    date.setFullYear(date.getFullYear() + 1);
  return date;
}

// Tries the 3-, 2-, then 1-token window ending at `end`. Returns the date and
// how many tokens it consumed.
export function matchDate(tokens, end, now) {
  for (let size = 3; size >= 1; size -= 1) {
    const start = end - size + 1;
    if (start < 0) continue;
    const words = tokens.slice(start, end + 1).map(clean);
    const date = matchDateWindow(words, now);
    if (date) return { date, consumed: size };
  }
  return null;
}

function matchDateWindow(words, now) {
  if (words.length === 1) {
    const word = words[0];
    if (word === "today" || word === "tod" || word === "tonight")
      return startOfDay(now);
    if (word === "tmrw" || word === "tmw" || word === "tomorrow") {
      const date = startOfDay(now);
      date.setDate(date.getDate() + 1);
      return date;
    }
    if (has(WEEKDAYS, word)) return upcomingWeekday(now, WEEKDAYS[word]);

    const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(word);
    if (iso) {
      const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
      return Number.isNaN(date.getTime()) ? null : date;
    }

    const slash = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/.exec(word);
    if (slash) {
      const month = Number(slash[1]) - 1;
      const day = Number(slash[2]);
      if (month < 0 || month > 11) return null;
      if (!slash[3]) return monthDay(month, day, now);
      const year = Number(slash[3]);
      return new Date(year < 100 ? 2000 + year : year, month, day);
    }
    return null;
  }

  if (words.length === 2) {
    const [first, second] = words;

    if ((first === "next" || first === "this") && has(WEEKDAYS, second))
      return upcomingWeekday(now, WEEKDAYS[second]);

    if (first === "next" && (second === "week" || second === "wk")) {
      const date = startOfDay(now);
      date.setDate(date.getDate() + 7);
      return date;
    }

    if (has(MONTHS, first) && /^\d{1,2}$/.test(second))
      return monthDay(MONTHS[first], Number(second), now);

    if (/^\d{1,2}$/.test(first) && has(MONTHS, second))
      return monthDay(MONTHS[second], Number(first), now);

    const relative = /^(\d{1,3})(d|w)$/.exec(second);
    if (first === "in" && relative) {
      const date = startOfDay(now);
      const amount = Number(relative[1]);
      date.setDate(date.getDate() + (relative[2] === "w" ? amount * 7 : amount));
      return date;
    }
    return null;
  }

  const relative = /^in (\d{1,3}) (days?|d|weeks?|w)$/.exec(words.join(" "));
  if (relative) {
    const date = startOfDay(now);
    const amount = Number(relative[1]);
    date.setDate(
      date.getDate() + (relative[2].startsWith("w") ? amount * 7 : amount)
    );
    return date;
  }
  return null;
}

/* -------------------------------- parse ---------------------------------- */

const SIGIL_RE = /(^|\s)([#/@*])("[^"]*"|[^\s]+)/g;
const BANG_RE = /(^|\s)(!{1,4})(?=\s|$)/g;
const BANG_PRIORITY = ["low", "medium", "high", "insane"];

/**
 * @param {string} input raw text from the quick-add box
 * @param {{spaces?: Array, now?: Date}} options
 * @returns parsed fields, plus `filled` marking what the text actually set
 */
export function parseQuick(input, options = {}) {
  const spaces = options.spaces || [];
  const now = options.now || new Date();

  const found = {
    spaceId: "",
    newSpaceName: "",
    type: "",
    priority: "",
    mode: "",
    date: "",
    time: "",
    endTime: "",
    location: "",
  };

  let text = typeof input === "string" ? input : "";

  text = text.replace(BANG_RE, (match, lead, bangs) => {
    found.priority = BANG_PRIORITY[Math.min(bangs.length, 4) - 1];
    return lead;
  });

  text = text.replace(SIGIL_RE, (match, lead, sigil, rawValue) => {
    const value = rawValue.replace(/^"|"$/g, "");
    if (!value) return match;

    if (sigil === "#") {
      const space = matchSpaces(value, spaces)[0];
      if (space) found.spaceId = space.id;
      else found.newSpaceName = value;
    } else if (sigil === "/") {
      const type = TYPE_ALIASES[clean(value)];
      if (!type) return match; // unknown /token stays in the title
      found.type = type;
    } else if (sigil === "@") {
      const time = parseTimeToken(value);
      if (!time) return match;
      found.time = time.time;
      found.endTime = time.endTime;
      if (time.isRange) found.mode = "event";
    } else if (sigil === "*") {
      found.location = value;
    }
    return lead;
  });

  // Suffix scan, right to left, stopping at the first non-vocabulary token.
  const tokens = text.split(/\s+/).filter(Boolean);
  let end = tokens.length - 1;

  while (end >= 0) {
    const token = clean(tokens[end]);
    if (!token) break;

    if (!found.date) {
      const match = matchDate(tokens, end, now);
      if (match) {
        found.date = toDateKey(match.date);
        end -= match.consumed;
        continue;
      }
    }

    if (!found.time) {
      const time = parseTimeToken(token);
      if (time) {
        found.time = time.time;
        found.endTime = time.endTime;
        if (time.isRange && !found.mode) found.mode = "event";
        end -= 1;
        continue;
      }
    }

    if (!found.type && has(TYPE_ALIASES, token)) {
      found.type = TYPE_ALIASES[token];
      end -= 1;
      continue;
    }

    if (!found.priority && has(PRIORITY_ALIASES, token)) {
      found.priority = PRIORITY_ALIASES[token];
      end -= 1;
      continue;
    }

    if (!found.mode && has(MODE_WORDS, token)) {
      found.mode = "event";
      end -= 1;
      continue;
    }

    // `end > 0` keeps a lone "bio" as a title rather than an empty item.
    if (!found.spaceId && !found.newSpaceName && end > 0) {
      const space = matchSpaces(token, spaces)[0];
      if (space) {
        found.spaceId = space.id;
        end -= 1;
        continue;
      }
    }

    break;
  }

  const titleTokens = tokens.slice(0, end + 1);

  // A class named inside the title tags the item but stays in the title:
  // "Scioly Orientation" is still called "Scioly Orientation". Only trailing
  // tags (handled by the suffix scan above) get consumed. Confident matches
  // only — exact, prefix or word-prefix.
  if (!found.spaceId && !found.newSpaceName) {
    for (const raw of titleTokens) {
      const token = clean(raw);
      if (token.length < 2) continue;

      const space = matchSpaces(token, spaces, 2)[0];
      if (space) {
        found.spaceId = space.id;
        break;
      }
    }
  }

  let title = titleTokens.join(" ").trim();
  let lastWord = clean(title.split(/\s+/).pop() || "");
  while (title && TRAILING_STOPWORDS.has(lastWord)) {
    title = title.slice(0, title.length - lastWord.length).trim();
    lastWord = clean(title.split(/\s+/).pop() || "");
  }

  const filled = {
    title: title !== "",
    space: !!(found.spaceId || found.newSpaceName),
    type: found.type !== "",
    priority: found.priority !== "",
    date: found.date !== "",
    time: found.time !== "",
    location: found.location !== "",
    mode: found.mode !== "",
  };

  return {
    ...found,
    title,
    // No type unless the line said one — better blank than a wrong guess.
    type: WORK_TYPE_IDS.includes(found.type) ? found.type : DEFAULT_TYPE,
    priority: PRIORITY_IDS.includes(found.priority)
      ? found.priority
      : DEFAULT_PRIORITY,
    mode: found.mode === "event" ? "event" : DEFAULT_MODE,
    filled,
  };
}

/* ----------------------------- autocomplete ------------------------------ */

// Which sigil token the caret sits inside, or null.
export function activeToken(text, caret) {
  const match = /(^|\s)([#/])([^\s]*)$/.exec(text.slice(0, caret));
  if (!match) return null;

  const tail = /^[^\s]*/.exec(text.slice(caret))[0];
  return {
    sigil: match[2],
    query: match[3],
    start: caret - match[3].length - 1,
    end: caret + tail.length,
  };
}

export function replaceToken(text, token, value) {
  const inserted = `${token.sigil}${/\s/.test(value) ? `"${value}"` : value}`;
  const before = text.slice(0, token.start);
  const after = text.slice(token.end);
  const spacer = after.startsWith(" ") ? "" : " ";
  return {
    text: `${before}${inserted}${spacer}${after}`,
    caret: before.length + inserted.length + spacer.length,
  };
}
