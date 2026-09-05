import { cosine, lexicalEncoder } from "./embed";
import { normalizePhrase } from "./tokenize";
import { TYPE_SEEDS } from "./extractors/types";

const SPACE_SIM_MIN = 0.42;
const TYPE_SIM_MIN = 0.38;

const compact = (text) => String(text || "").toLowerCase().replace(/[^a-z0-9]/g, "");

function isSubsequence(needle, haystack) {
  let index = 0;
  for (const char of haystack) {
    if (char === needle[index]) index += 1;
    if (index === needle.length) return true;
  }
  return false;
}

export function matchSpaces(query, spaces, maxScore = 4) {
  const target = compact(query);
  if (!target) return [];

  const scored = [];
  (spaces || []).forEach((space) => {
    const full = compact(space.name);
    const parts = String(space.name || "")
      .toLowerCase()
      .split(/\s+/)
      .map(compact);
    const initials = compact(
      String(space.name || "")
        .split(/\s+/)
        .map((word) => word[0] || "")
        .join("")
    );

    let score = null;
    if (full === target) score = 0;
    else if (full.startsWith(target)) score = 1;
    else if (parts.some((part) => part && part.startsWith(target))) score = 2;
    else if (initials === target) score = 3;
    else if (target.length >= 3 && isSubsequence(target, full)) score = 4;

    if (score !== null && score <= maxScore) scored.push({ space, score });
  });

  scored.sort(
    (a, b) => a.score - b.score || a.space.name.localeCompare(b.space.name)
  );
  return scored.map((entry) => entry.space);
}

const LADDER_CONFIDENCE = [0.98, 0.92, 0.88, 0.82, 0.62];

export function ladderSpace(query, spaces, maxScore = 4) {
  const target = compact(query);
  if (!target) return null;

  const matches = matchSpaces(query, spaces, maxScore);
  if (matches.length === 0) return null;

  const best = matches[0];
  const full = compact(best.name);
  const parts = String(best.name || "")
    .toLowerCase()
    .split(/\s+/)
    .map(compact);
  const initials = compact(
    String(best.name || "")
      .split(/\s+/)
      .map((word) => word[0] || "")
      .join("")
  );

  let score = 4;
  if (full === target) score = 0;
  else if (full.startsWith(target)) score = 1;
  else if (parts.some((part) => part && part.startsWith(target))) score = 2;
  else if (initials === target) score = 3;

  return { space: best, confidence: LADDER_CONFIDENCE[score], score };
}

export function spaceDocument(space) {
  return [space.name, space.kind, space.teacher, space.room]
    .filter(Boolean)
    .join(" ");
}

export function buildSpaceIndex(spaces, encoder = lexicalEncoder) {
  return (spaces || []).map((space) => ({
    space,
    nameVector: encoder.encode(space.name || ""),
    docVector: encoder.encode(spaceDocument(space)),
  }));
}

export function spaceSimilarity(query, entry) {
  return Math.max(
    cosine(query, entry.nameVector),
    cosine(query, entry.docVector) * 0.9
  );
}

export function buildTypeIndex(encoder = lexicalEncoder) {
  return Object.entries(TYPE_SEEDS).map(([type, seed]) => ({
    type,
    vector: encoder.encode(seed),
  }));
}

export function resolveSpace(phrase, spaces, options = {}) {
  const encoder = options.encoder || lexicalEncoder;
  const maxScore = options.maxScore === undefined ? 4 : options.maxScore;

  const ladder = ladderSpace(phrase, spaces, maxScore);
  if (ladder) return { spaceId: ladder.space.id, confidence: ladder.confidence };

  const normalized = normalizePhrase(phrase);
  if (!normalized) return null;

  const index = options.spaceIndex || buildSpaceIndex(spaces, encoder);
  if (index.length === 0) return null;

  const query = encoder.encode(normalized);
  let best = null;
  index.forEach((entry) => {
    const score = spaceSimilarity(query, entry);
    if (!best || score > best.score) best = { score, entry };
  });

  if (!best || best.score < SPACE_SIM_MIN) return null;
  return {
    spaceId: best.entry.space.id,
    confidence: Math.min(0.8, best.score),
    similarity: best.score,
  };
}

export function resolveType(phrase, options = {}) {
  const encoder = options.encoder || lexicalEncoder;
  const normalized = normalizePhrase(phrase);
  if (!normalized) return null;

  const index = options.typeIndex || buildTypeIndex(encoder);
  const query = encoder.encode(normalized);

  let best = null;
  index.forEach((entry) => {
    if (entry.type === "other") return;
    const score = cosine(query, entry.vector);
    if (!best || score > best.score) best = { score, entry };
  });

  if (!best || best.score < TYPE_SIM_MIN) return null;
  return {
    type: best.entry.type,
    confidence: Math.min(0.75, best.score),
    similarity: best.score,
  };
}

export const THRESHOLDS = { SPACE_SIM_MIN, TYPE_SIM_MIN };
