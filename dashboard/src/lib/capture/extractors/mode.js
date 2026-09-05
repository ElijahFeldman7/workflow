import { makeSpan } from "../spans";
import { words } from "../tokenize";

export const EVENT_MARKERS = new Set(["event", "meeting", "mtg"]);

export const EVENT_NOUNS = new Set([
  "fair",
  "practice",
  "rehearsal",
  "concert",
  "game",
  "match",
  "orientation",
  "session",
  "party",
  "trip",
  "tryouts",
  "interview",
  "conference",
  "assembly",
  "recital",
  "scrimmage",
]);

export const DUE_WORDS = new Set([
  "due",
  "submit",
  "deadline",
  "turnin",
  "handin",
  "upload",
]);

const DUE_PHRASES = new Set(["turn in", "hand in", "due by", "due on"]);

export function findModes(tokens) {
  const found = [];

  tokens.forEach((token, index) => {
    if (EVENT_MARKERS.has(token.norm))
      found.push(makeSpan("mode", "event", index, index, 0.8));
    else if (EVENT_NOUNS.has(token.norm))
      found.push(makeSpan("mode", "event", index, index, 0.7, { keep: true }));

    if (DUE_WORDS.has(token.norm))
      found.push(makeSpan("mode", "due", index, index, 0.75));
  });

  for (let from = 0; from + 1 < tokens.length; from += 1) {
    const phrase = words(tokens, from, from + 1).join(" ");
    if (DUE_PHRASES.has(phrase))
      found.push(makeSpan("mode", "due", from, from + 1, 0.78, { keep: true }));
  }

  return found;
}
