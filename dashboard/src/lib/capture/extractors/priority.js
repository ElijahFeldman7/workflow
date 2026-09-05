import { makeSpan } from "../spans";
import { words } from "../tokenize";

export const PRIORITY_ALIASES = {
  low: "low",
  lowkey: "low",
  whenever: "low",
  norush: "low",
  someday: "low",
  med: "medium",
  medium: "medium",
  normal: "medium",
  high: "high",
  urgent: "high",
  important: "high",
  asap: "high",
  soon: "high",
  critical: "insane",
  insane: "insane",
  emergency: "insane",
};

const PHRASES = {
  "no rush": "low",
  "low key": "low",
  "low priority": "low",
  "high priority": "high",
  "top priority": "high",
  "super important": "insane",
  "really important": "insane",
};

const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

export const BANG_PRIORITY = ["low", "medium", "high", "insane"];

export function findPriorities(tokens) {
  const found = [];

  tokens.forEach((token, index) => {
    const bangs = /^(!{1,4})$/.exec(token.raw);
    if (bangs) {
      found.push(
        makeSpan(
          "priority",
          BANG_PRIORITY[Math.min(bangs[1].length, 4) - 1],
          index,
          index,
          1
        )
      );
    }
  });

  for (let from = 0; from < tokens.length; from += 1) {
    for (let size = 2; size >= 1; size -= 1) {
      const to = from + size - 1;
      if (to >= tokens.length) continue;
      const list = words(tokens, from, to);
      if (list.some((word) => word === "")) continue;

      const phrase = list.join(" ");
      if (size === 2 && has(PHRASES, phrase)) {
        found.push(makeSpan("priority", PHRASES[phrase], from, to, 0.85));
        break;
      }

      const key = list.join("");
      if (size === 1 && has(PRIORITY_ALIASES, key)) {
        found.push(makeSpan("priority", PRIORITY_ALIASES[key], from, to, 0.75));
        break;
      }
    }
  }

  return found;
}
