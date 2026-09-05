import { normalizePhrase } from "./tokenize";

export const LEARNABLE_FIELDS = ["space", "type", "priority", "mode"];

export function memoryKey(phrase, field) {
  const normalized = normalizePhrase(phrase);
  if (!normalized || !LEARNABLE_FIELDS.includes(field)) return "";
  return `${field}:${normalized.replace(/ /g, "_")}`;
}

export function emptyMemory() {
  return {};
}

export function lookup(memory, phrase, field) {
  const key = memoryKey(phrase, field);
  if (!key || !memory) return null;
  const entry = memory[key];
  if (!entry || !entry.value) return null;
  return entry;
}

export function recordCorrection(memory, phrase, field, value) {
  const key = memoryKey(phrase, field);
  if (!key || !value) return memory || {};

  const current = (memory && memory[key]) || null;
  const sameValue = current && current.value === value;

  return {
    ...(memory || {}),
    [key]: {
      phrase: normalizePhrase(phrase),
      field,
      value,
      count: sameValue ? (current.count || 0) + 1 : 1,
      updatedAt: Date.now(),
    },
  };
}

export function forget(memory, phrase, field) {
  const key = memoryKey(phrase, field);
  if (!key || !memory || !memory[key]) return memory || {};
  const next = { ...memory };
  delete next[key];
  return next;
}

export function normalizeMemory(raw) {
  if (!raw || typeof raw !== "object") return {};
  const out = {};
  Object.entries(raw).forEach(([key, entry]) => {
    if (!entry || typeof entry !== "object") return;
    if (typeof entry.value !== "string" || entry.value === "") return;
    if (!LEARNABLE_FIELDS.includes(entry.field)) return;
    out[key] = {
      phrase: typeof entry.phrase === "string" ? entry.phrase : "",
      field: entry.field,
      value: entry.value,
      count: Number(entry.count) || 1,
      updatedAt: Number(entry.updatedAt) || 0,
    };
  });
  return out;
}

export function memoryConfidence(entry) {
  const count = Math.max(1, Number(entry && entry.count) || 1);
  return Math.min(0.97, 0.88 + 0.03 * (count - 1));
}
