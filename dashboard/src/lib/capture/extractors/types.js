import { makeSpan } from "../spans";
import { words } from "../tokenize";
import { cosine, lexicalEncoder } from "../embed";
import { buildTypeIndex, THRESHOLDS } from "../resolve";

export const TYPE_ALIASES = {
  hw: "hw",
  homework: "hw",
  assignment: "hw",
  worksheet: "hw",
  ws: "hw",
  pset: "hw",
  problemset: "hw",
  quiz: "quiz",
  quizzes: "quiz",
  test: "test",
  tests: "test",
  exam: "test",
  midterm: "test",
  lab: "lab",
  labs: "lab",
  reading: "reading",
  read: "reading",
  annotate: "reading",
  project: "project",
  proj: "project",
  presentation: "project",
  final: "final",
  finals: "final",
  seminar: "seminar",
  lecture: "seminar",
  workshop: "seminar",
  application: "application",
  app: "application",
  apply: "application",
  other: "other",
  misc: "other",
};

export const TYPE_SEEDS = {
  hw: "homework assignment problem set worksheet pset exercises questions",
  quiz: "quiz pop quiz short assessment check for understanding",
  test: "test exam midterm unit test assessment",
  lab: "lab report experiment write up data analysis procedure",
  reading: "reading chapter pages textbook article annotate notes",
  project: "project presentation slides deck poster build model",
  final: "final exam final project finals week cumulative",
  seminar: "seminar lecture talk workshop session guest speaker",
  application: "application apply form essay submission portal",
  other: "other miscellaneous general",
};

const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

export function findTypes(tokens, ctx) {
  const encoder = (ctx && ctx.encoder) || lexicalEncoder;
  const index = (ctx && ctx.typeIndex) || buildTypeIndex(encoder);
  const found = [];

  for (let from = 0; from < tokens.length; from += 1) {
    for (let size = 2; size >= 1; size -= 1) {
      const to = from + size - 1;
      if (to >= tokens.length) continue;

      const list = words(tokens, from, to);
      if (list.some((word) => word === "")) continue;

      const key = list.join("");
      if (key && has(TYPE_ALIASES, key)) {
        found.push(makeSpan("type", TYPE_ALIASES[key], from, to, 0.8));
        continue;
      }

      if (key.length < 5) continue;

      const query = encoder.encode(list.join(" "));
      let best = null;
      index.forEach((entry) => {
        if (entry.type === "other") return;
        const score = cosine(query, entry.vector);
        if (!best || score > best.score) best = { score, entry };
      });

      if (!best || best.score < THRESHOLDS.TYPE_SIM_MIN) continue;

      found.push(
        makeSpan("type", best.entry.type, from, to, Math.min(0.72, best.score + 0.2), {
          similarity: best.score,
          keep: true,
        })
      );
    }
  }

  return found;
}
