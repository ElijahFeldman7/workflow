import { MS_PER_DAY, toDateKey } from "../../../constants/work";
import { makeSpan } from "../spans";
import { words } from "../tokenize";

export const WEEKDAYS = {
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

export const MONTHS = {
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

const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

export const startOfDay = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const shift = (date, days) => {
  const next = startOfDay(date);
  next.setDate(next.getDate() + days);
  return next;
};

function upcomingWeekday(from, weekday, allowToday) {
  const date = startOfDay(from);
  let delta = (weekday - date.getDay() + 7) % 7;
  if (delta === 0 && !allowToday) delta = 7;
  date.setDate(date.getDate() + delta);
  return date;
}

function lastWeekday(from, weekday) {
  const date = startOfDay(from);
  let delta = (date.getDay() - weekday + 7) % 7;
  if (delta === 0) delta = 7;
  date.setDate(date.getDate() - delta);
  return date;
}

export function monthDay(month, day, now) {
  if (day < 1 || day > 31) return null;
  const date = new Date(now.getFullYear(), month, day);
  if (date.getMonth() !== month) return null;
  if (startOfDay(now) - date > 182 * MS_PER_DAY)
    date.setFullYear(date.getFullYear() + 1);
  return date;
}

export function dayNumber(word) {
  const match = /^(\d{1,2})(st|nd|rd|th)?$/.exec(word);
  if (!match) return null;
  const value = Number(match[1]);
  if (value < 1 || value > 31) return null;
  return { value, ordinal: !!match[2] };
}

function dayOfMonth(day, now) {
  const date = new Date(now.getFullYear(), now.getMonth(), day);
  if (date.getMonth() !== now.getMonth()) return null;
  if (date < startOfDay(now)) {
    const next = new Date(now.getFullYear(), now.getMonth() + 1, day);
    if (next.getDate() !== day) return null;
    return next;
  }
  return date;
}

function endOfMonth(now) {
  return new Date(now.getFullYear(), now.getMonth() + 1, 0);
}

function endOfWeek(now) {
  return upcomingWeekday(now, 5, true);
}

function matchWindow(list, now) {
  const size = list.length;

  if (size === 1) {
    const word = list[0];
    if (!word) return null;

    if (word === "today" || word === "tod" || word === "tonight")
      return { date: startOfDay(now), confidence: 0.98 };
    if (word === "tomorrow" || word === "tmrw" || word === "tmw" || word === "tmr")
      return { date: shift(now, 1), confidence: 0.98 };
    if (word === "yesterday" || word === "yest")
      return { date: shift(now, -1), confidence: 0.95 };
    if (word === "eod") return { date: startOfDay(now), confidence: 0.9 };

    if (has(WEEKDAYS, word))
      return { date: upcomingWeekday(now, WEEKDAYS[word]), confidence: 0.92 };

    const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(word);
    if (iso) {
      const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
      return Number.isNaN(date.getTime())
        ? null
        : { date, confidence: 0.99 };
    }

    const slash = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/.exec(word);
    if (slash) {
      const month = Number(slash[1]) - 1;
      const day = Number(slash[2]);
      if (month < 0 || month > 11) return null;
      if (!slash[3]) {
        const date = monthDay(month, day, now);
        return date ? { date, confidence: 0.95 } : null;
      }
      const year = Number(slash[3]);
      const date = new Date(year < 100 ? 2000 + year : year, month, day);
      return date.getMonth() === month ? { date, confidence: 0.97 } : null;
    }

    const relative = /^(\d{1,3})(d|w|mo)$/.exec(word);
    if (relative) {
      const amount = Number(relative[1]);
      if (relative[2] === "d") return { date: shift(now, amount), confidence: 0.8 };
      if (relative[2] === "w")
        return { date: shift(now, amount * 7), confidence: 0.8 };
      const date = startOfDay(now);
      date.setMonth(date.getMonth() + amount);
      return { date, confidence: 0.8 };
    }

    const ordinal = dayNumber(word);
    if (ordinal && ordinal.ordinal) {
      const date = dayOfMonth(ordinal.value, now);
      return date ? { date, confidence: 0.85 } : null;
    }
    return null;
  }

  if (size === 2) {
    const [first, second] = list;

    if ((first === "next" || first === "this") && has(WEEKDAYS, second))
      return {
        date: upcomingWeekday(now, WEEKDAYS[second], first === "this"),
        confidence: 0.95,
      };

    if (first === "last" && has(WEEKDAYS, second))
      return { date: lastWeekday(now, WEEKDAYS[second]), confidence: 0.94 };

    if (first === "next" && (second === "week" || second === "wk"))
      return { date: shift(now, 7), confidence: 0.85 };

    if (first === "next" && second === "month") {
      const date = startOfDay(now);
      date.setMonth(date.getMonth() + 1);
      return { date, confidence: 0.85 };
    }

    if (first === "this" && second === "weekend")
      return { date: upcomingWeekday(now, 6, true), confidence: 0.85 };

    if (first === "next" && second === "weekend")
      return { date: shift(upcomingWeekday(now, 6, true), 7), confidence: 0.85 };

    if (has(MONTHS, first)) {
      const ordinal = dayNumber(second);
      if (ordinal) {
        const date = monthDay(MONTHS[first], ordinal.value, now);
        if (date) return { date, confidence: 0.96 };
      }
    }

    if (has(MONTHS, second)) {
      const ordinal = dayNumber(first);
      if (ordinal) {
        const date = monthDay(MONTHS[second], ordinal.value, now);
        if (date) return { date, confidence: 0.94 };
      }
    }

    const relative = /^(\d{1,3})(d|w|mo)$/.exec(second);
    if (first === "in" && relative) {
      const amount = Number(relative[1]);
      if (relative[2] === "d") return { date: shift(now, amount), confidence: 0.9 };
      if (relative[2] === "w")
        return { date: shift(now, amount * 7), confidence: 0.9 };
      const date = startOfDay(now);
      date.setMonth(date.getMonth() + amount);
      return { date, confidence: 0.9 };
    }
    return null;
  }

  if (size === 3) {
    const [first, second, third] = list;

    if (first === "in" && /^\d{1,3}$/.test(second)) {
      const amount = Number(second);
      if (/^(day|days)$/.test(third))
        return { date: shift(now, amount), confidence: 0.94 };
      if (/^(week|weeks|wk|wks)$/.test(third))
        return { date: shift(now, amount * 7), confidence: 0.94 };
      if (/^(month|months|mo)$/.test(third)) {
        const date = startOfDay(now);
        date.setMonth(date.getMonth() + amount);
        return { date, confidence: 0.94 };
      }
      return null;
    }

    if (first === "end" && second === "of") {
      if (third === "week") return { date: endOfWeek(now), confidence: 0.85 };
      if (third === "month") return { date: endOfMonth(now), confidence: 0.85 };
      return null;
    }

    if (has(MONTHS, second)) {
      const ordinal = dayNumber(third);
      if (first === "the" && ordinal) {
        const date = monthDay(MONTHS[second], ordinal.value, now);
        if (date) return { date, confidence: 0.9 };
      }
    }
    return null;
  }

  if (size === 4) {
    const [first, second, third, fourth] = list;
    if (first === "end" && second === "of" && third === "the") {
      if (fourth === "week") return { date: endOfWeek(now), confidence: 0.88 };
      if (fourth === "month") return { date: endOfMonth(now), confidence: 0.88 };
    }
    if (first === "the" && second === "week" && third === "of") return null;
    return null;
  }

  return null;
}

export function findDates(tokens, ctx) {
  const now = ctx.now || new Date();
  const found = [];

  for (let from = 0; from < tokens.length; from += 1) {
    for (let size = 4; size >= 1; size -= 1) {
      const to = from + size - 1;
      if (to >= tokens.length) continue;
      const match = matchWindow(words(tokens, from, to), now);
      if (!match) continue;
      found.push(
        makeSpan("date", toDateKey(match.date), from, to, match.confidence)
      );
      break;
    }
  }

  return found;
}
