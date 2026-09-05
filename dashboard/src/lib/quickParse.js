import { captureText } from "./capture/capture";
import { matchSpaces } from "./capture/resolve";
import { findDates } from "./capture/extractors/dates";
import { parseTimeToken } from "./capture/extractors/times";
import { tokenize } from "./capture/tokenize";
import { fromDateKey } from "../constants/work";

export { matchSpaces, parseTimeToken };

export function parseQuick(input, options = {}) {
  return captureText(input, options);
}

export function matchDate(tokens, end, now) {
  const list = Array.isArray(tokens) ? tokens : [];
  const source = list.join(" ");
  const parsed = tokenize(source);
  const spans = findDates(parsed, { now: now || new Date() });

  const hit = spans.filter((span) => span.to === end).sort((a, b) => a.from - b.from)[0];
  if (!hit) return null;

  return { date: fromDateKey(hit.value), consumed: hit.to - hit.from + 1 };
}

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
