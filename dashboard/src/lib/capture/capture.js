import {
  WORK_TYPE_IDS,
  PRIORITY_IDS,
  DEFAULT_TYPE,
  DEFAULT_PRIORITY,
  DEFAULT_MODE,
} from "../../constants/work";
import { tokenize, words, normalizePhrase } from "./tokenize";
import { selectSpans, coveredIndices, makeSpan } from "./spans";
import { findSigils } from "./extractors/sigils";
import { findDates } from "./extractors/dates";
import { findTimes, findDurations, addMinutes } from "./extractors/times";
import { findTypes } from "./extractors/types";
import { findPriorities } from "./extractors/priority";
import { findModes } from "./extractors/mode";
import { findLocations } from "./extractors/location";
import { findSpaceMentions } from "./extractors/spaces";
import { lexicalEncoder } from "./embed";
import { resolveSpace } from "./resolve";
import { lookup, memoryConfidence, LEARNABLE_FIELDS } from "./memory";

const CONSUME_MIN = 0.65;

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

const ANYWHERE_FIELDS = new Set(["date", "time", "duration"]);

function memorySpans(tokens, memory) {
  if (!memory) return [];
  const found = [];

  for (let from = 0; from < tokens.length; from += 1) {
    for (let size = 3; size >= 1; size -= 1) {
      const to = from + size - 1;
      if (to >= tokens.length) continue;
      const phrase = words(tokens, from, to).join(" ").trim();
      if (!phrase) continue;

      let matched = false;
      LEARNABLE_FIELDS.forEach((field) => {
        const entry = lookup(memory, phrase, field);
        if (!entry) return;
        found.push(
          makeSpan(field, entry.value, from, to, memoryConfidence(entry), {
            learned: true,
          })
        );
        matched = true;
      });
      if (matched) break;
    }
  }

  return found;
}

function tailStart(tokens, consumable) {
  let index = tokens.length - 1;
  let boundary = tokens.length;

  while (index >= 0) {
    if (consumable.has(index)) {
      boundary = index;
      index -= 1;
      continue;
    }
    if (TRAILING_STOPWORDS.has(tokens[index].norm) && boundary <= index + 1) {
      index -= 1;
      continue;
    }
    break;
  }

  return boundary;
}

function buildTitle(tokens, consumed) {
  let title = tokens
    .filter((token) => !consumed.has(token.index))
    .map((token) => token.raw)
    .join(" ")
    .trim();

  let last = tokens.length ? title.split(/\s+/).pop() || "" : "";
  let lastNorm = last.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");

  while (title && TRAILING_STOPWORDS.has(lastNorm)) {
    title = title.slice(0, title.length - last.length).trim();
    last = title.split(/\s+/).pop() || "";
    lastNorm = last.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
  }

  return title;
}

export function captureText(input, options = {}) {
  const spaces = options.spaces || [];
  const now = options.now || new Date();
  const encoder = options.encoder || lexicalEncoder;
  const memory = options.memory || null;
  const ctx = {
    spaces,
    now,
    encoder,
    spaceIndex: options.spaceIndex,
    typeIndex: options.typeIndex,
  };

  const tokens = tokenize(input);

  const candidates = [
    ...findSigils(tokens),
    ...memorySpans(tokens, memory),
    ...findDates(tokens, ctx),
    ...findTimes(tokens),
    ...findDurations(tokens),
    ...findTypes(tokens, ctx),
    ...findPriorities(tokens),
    ...findModes(tokens),
    ...findLocations(tokens),
    ...findSpaceMentions(tokens, ctx),
  ];

  const selected = selectSpans(candidates);

  const strong = selected.filter((span) => span.confidence >= CONSUME_MIN);
  const consumableIndices = coveredIndices(
    strong.filter((span) => !span.keep)
  );
  const boundary = tailStart(tokens, consumableIndices);

  const isAnywhere = (span) =>
    span.sigil !== undefined ||
    span.confidence >= 1 ||
    ANYWHERE_FIELDS.has(span.field);

  const consuming = strong.filter(
    (span) => !span.keep && (isAnywhere(span) || span.from >= boundary)
  );

  const build = (list) => {
    const set = new Set();
    list.forEach((span) => {
      for (let index = span.from; index <= span.to; index += 1) set.add(index);
    });
    return set;
  };

  let kept = consuming;
  let consumed = build(kept);

  if (buildTitle(tokens, consumed) === "") {
    const firstExplicit = kept
      .filter(isAnywhere)
      .reduce((min, span) => Math.min(min, span.from), tokens.length);
    kept = kept.filter((span) => isAnywhere(span) || span.from >= firstExplicit);
    consumed = build(kept);
  }

  while (buildTitle(tokens, consumed) === "" && kept.length > 0) {
    const restorable = kept.filter((span) => !isAnywhere(span));
    if (restorable.length === 0) break;
    const earliest = restorable.reduce((a, b) => (a.from <= b.from ? a : b));
    kept = kept.filter((span) => span !== earliest);
    consumed = build(kept);
  }

  const found = {};
  selected.forEach((span) => {
    if (found[span.field] === undefined) found[span.field] = span;
  });

  const title = buildTitle(tokens, consumed);

  const confidence = {};
  const setField = (field, value, score) => {
    if (value === undefined || value === null || value === "") return;
    confidence[field] = score;
  };

  let spaceId = "";
  let newSpaceName = "";
  const spaceSpan = found.space;

  if (spaceSpan) {
    if (spaceSpan.learned || spaceSpan.resolved) {
      spaceId = spaceSpan.value;
      setField("space", spaceId, spaceSpan.confidence);
    } else {
      const resolved = resolveSpace(spaceSpan.value, spaces, {
        encoder,
        spaceIndex: options.spaceIndex,
      });
      if (resolved) {
        spaceId = resolved.spaceId;
        setField("space", spaceId, resolved.confidence);
      } else if (spaceSpan.sigil === "#") {
        newSpaceName = spaceSpan.value;
        setField("space", newSpaceName, 0.9);
      }
    }
  }

  const type = found.type ? found.type.value : "";
  if (type) setField("type", type, found.type.confidence);

  const priority = found.priority ? found.priority.value : "";
  if (priority) setField("priority", priority, found.priority.confidence);

  const date = found.date ? found.date.value : "";
  if (date) setField("date", date, found.date.confidence);

  const timeSpan = found.time;
  let time = timeSpan ? timeSpan.value : "";
  let endTime = timeSpan && timeSpan.endTime ? timeSpan.endTime : "";

  if (time) setField("time", time, timeSpan.confidence);

  if (time && !endTime && found.duration) {
    endTime = addMinutes(time, found.duration.value);
  }

  const location = found.location ? found.location.value : "";
  if (location) setField("location", location, found.location.confidence);

  let mode = "";
  if (found.mode) mode = found.mode.value;
  if (endTime) mode = "event";
  if (found.mode && found.mode.value === "due" && !endTime) mode = "due";

  const filled = {
    title: title !== "",
    space: !!(spaceId || newSpaceName),
    type: type !== "",
    priority: priority !== "",
    date: date !== "",
    time: time !== "",
    location: location !== "",
    mode: mode !== "",
  };

  return {
    title,
    spaceId,
    newSpaceName,
    type: WORK_TYPE_IDS.includes(type) ? type : DEFAULT_TYPE,
    priority: PRIORITY_IDS.includes(priority) ? priority : DEFAULT_PRIORITY,
    mode: mode === "event" ? "event" : DEFAULT_MODE,
    date,
    time,
    endTime,
    location,
    filled,
    confidence,
    spans: selected,
    phrases: buildPhrases(tokens, selected),
  };
}

function buildPhrases(tokens, spans) {
  const out = {};
  spans.forEach((span) => {
    if (out[span.field] !== undefined) return;
    out[span.field] = normalizePhrase(
      tokens
        .slice(span.from, span.to + 1)
        .map((token) => token.text)
        .join(" ")
    );
  });
  return out;
}
