import { makeSpan } from "../spans";
import { parseTimeToken } from "./times";
import { TYPE_ALIASES } from "./types";
import { normalizeWord } from "../tokenize";

const SIGIL_FIELDS = { "#": "space", "/": "type", "@": "time", "*": "location" };

const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

export function findSigils(tokens) {
  const found = [];

  tokens.forEach((token, index) => {
    const sigil = token.raw[0];
    const field = SIGIL_FIELDS[sigil];
    if (!field) return;

    const value = token.raw.slice(1).replace(/^"|"$/g, "");
    if (!value) return;

    if (field === "type") {
      const key = normalizeWord(value);
      if (!has(TYPE_ALIASES, key)) return;
      found.push(makeSpan("type", TYPE_ALIASES[key], index, index, 1, { sigil }));
      return;
    }

    if (field === "time") {
      const parsed = parseTimeToken(value);
      if (!parsed) return;
      found.push(
        makeSpan("time", parsed.time, index, index, 1, {
          sigil,
          endTime: parsed.endTime,
          isRange: parsed.isRange,
        })
      );
      return;
    }

    found.push(makeSpan(field, value, index, index, 1, { sigil }));
  });

  return found;
}
