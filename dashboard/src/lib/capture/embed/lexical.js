import { normalizePhrase } from "../tokenize";

export const DIMS = 512;

const WORD_WEIGHT = 2;

function hash(feature) {
  let value = 2166136261;
  for (let index = 0; index < feature.length; index += 1) {
    value ^= feature.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return (value >>> 0) % DIMS;
}

function ngrams(word, size) {
  const padded = `^${word}$`;
  const out = [];
  for (let index = 0; index + size <= padded.length; index += 1) {
    out.push(padded.slice(index, index + size));
  }
  return out;
}

export function features(text) {
  const phrase = normalizePhrase(text);
  if (!phrase) return [];

  const out = [];
  phrase.split(" ").forEach((word) => {
    if (!word) return;
    out.push({ feature: `w:${word}`, weight: WORD_WEIGHT });
    ngrams(word, 2).forEach((gram) => out.push({ feature: `b:${gram}`, weight: 1 }));
    ngrams(word, 3).forEach((gram) => out.push({ feature: `t:${gram}`, weight: 1 }));
  });
  return out;
}

export function encode(text) {
  const vector = new Float32Array(DIMS);
  const counts = new Map();

  features(text).forEach(({ feature, weight }) => {
    counts.set(feature, (counts.get(feature) || 0) + weight);
  });

  counts.forEach((count, feature) => {
    vector[hash(feature)] += 1 + Math.log(count);
  });

  let norm = 0;
  for (let index = 0; index < DIMS; index += 1) norm += vector[index] * vector[index];
  norm = Math.sqrt(norm);
  if (norm === 0) return vector;
  for (let index = 0; index < DIMS; index += 1) vector[index] /= norm;

  return vector;
}

export const lexicalEncoder = {
  id: "lexical",
  dims: DIMS,
  ready: true,
  encode,
  encodeAll: (list) => list.map(encode),
};
