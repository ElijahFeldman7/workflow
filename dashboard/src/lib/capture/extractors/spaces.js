import { makeSpan } from "../spans";
import { words } from "../tokenize";
import {
  ladderSpace,
  buildSpaceIndex,
  spaceSimilarity,
  THRESHOLDS,
} from "../resolve";
import { lexicalEncoder } from "../embed";
import { TYPE_ALIASES } from "./types";
import { PRIORITY_ALIASES } from "./priority";
import { EVENT_MARKERS, EVENT_NOUNS, DUE_WORDS } from "./mode";

const VOCAB = new Set([
  ...Object.keys(TYPE_ALIASES),
  ...Object.keys(PRIORITY_ALIASES),
  ...EVENT_MARKERS,
  ...EVENT_NOUNS,
  ...DUE_WORDS,
  "the",
  "and",
  "for",
  "with",
  "next",
  "this",
  "last",
  "chapter",
  "unit",
  "page",
  "pages",
]);

const compact = (value) => value.replace(/[^a-z0-9]/g, "");

export function findSpaceMentions(tokens, ctx) {
  const spaces = (ctx && ctx.spaces) || [];
  if (spaces.length === 0) return [];

  const encoder = (ctx && ctx.encoder) || lexicalEncoder;
  const index = (ctx && ctx.spaceIndex) || buildSpaceIndex(spaces, encoder);
  const found = [];

  for (let from = 0; from < tokens.length; from += 1) {
    for (let size = 2; size >= 1; size -= 1) {
      const to = from + size - 1;
      if (to >= tokens.length) continue;

      const list = words(tokens, from, to);
      if (list.some((word) => word === "")) continue;
      const phrase = list.join(" ");
      if (phrase.length < 2) continue;

      const ladder = ladderSpace(phrase, spaces, 3);
      if (ladder) {
        const isVocab = VOCAB.has(compact(phrase));
        if (ladder.score === 0 || (!isVocab && phrase.length >= 3)) {
          found.push(
            makeSpan("space", ladder.space.id, from, to, ladder.confidence, {
              resolved: true,
            })
          );
          continue;
        }
      }

      if (phrase.length < 4 || VOCAB.has(compact(phrase))) continue;

      const query = encoder.encode(phrase);
      let best = null;
      index.forEach((entry) => {
        const score = spaceSimilarity(query, entry);
        if (!best || score > best.score) best = { score, entry };
      });

      if (!best || best.score < THRESHOLDS.SPACE_SIM_MIN) continue;

      found.push(
        makeSpan(
          "space",
          best.entry.space.id,
          from,
          to,
          Math.min(0.8, best.score + 0.2),
          { resolved: true, similarity: best.score }
        )
      );
    }
  }

  return found;
}
