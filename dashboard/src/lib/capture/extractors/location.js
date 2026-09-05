import { makeSpan } from "../spans";
import { joinTokens, words } from "../tokenize";

const ROOM_WORDS = new Set(["room", "rm"]);
const PREPOSITIONS = new Set(["in", "at"]);

export function findLocations(tokens) {
  const found = [];

  for (let from = 0; from < tokens.length; from += 1) {
    const list = words(tokens, from, Math.min(from + 2, tokens.length - 1));
    const offset = PREPOSITIONS.has(list[0]) ? 1 : 0;
    const head = list[offset];
    const tail = list[offset + 1];

    if (!head || !ROOM_WORDS.has(head)) continue;
    if (!tail || !/^[a-z]?\d{1,4}[a-z]?$/.test(tail)) continue;

    const to = from + offset + 1;
    if (to >= tokens.length) continue;

    found.push(
      makeSpan(
        "location",
        joinTokens(tokens, from + offset, to),
        from,
        to,
        0.85
      )
    );
  }

  return found;
}
