import { captureText } from "./capture";
import { tokenize, words, normalizePhrase } from "./tokenize";
import { spaceDocument } from "./resolve";
import { TYPE_SEEDS } from "./extractors/types";
import { lexicalEncoder } from "./embed";

export function candidatePhrases(text) {
  const tokens = tokenize(text);
  const phrases = new Set();

  for (let from = 0; from < tokens.length; from += 1) {
    for (let size = 1; size <= 2; size += 1) {
      const to = from + size - 1;
      if (to >= tokens.length) continue;
      const phrase = words(tokens, from, to).join(" ").trim();
      if (phrase) phrases.add(phrase);
    }
  }

  return [...phrases];
}

export function cachedEncoder(encoder, entries) {
  const cache = new Map();
  entries.forEach(([phrase, vector]) => cache.set(normalizePhrase(phrase), vector));

  return {
    id: `${encoder.id}-cached`,
    dims: encoder.dims,
    ready: true,
    encode: (text) => {
      const hit = cache.get(normalizePhrase(text));
      return hit || new Float32Array(encoder.dims);
    },
    encodeAll: (list) => list.map((text) => cache.get(normalizePhrase(text))),
  };
}

export async function captureTextAsync(input, options = {}) {
  const encoder = options.encoder || lexicalEncoder;
  if (encoder === lexicalEncoder || encoder.id === "lexical")
    return captureText(input, options);

  const spaces = options.spaces || [];
  const phrases = candidatePhrases(input);
  const names = spaces.map((space) => space.name || "");
  const documents = spaces.map(spaceDocument);
  const typeEntries = Object.entries(TYPE_SEEDS);

  const all = [
    ...phrases,
    ...names,
    ...documents,
    ...typeEntries.map(([, seed]) => seed),
  ];

  const vectors = await encoder.encodeAll(all);

  let cursor = 0;
  const take = (count) => vectors.slice(cursor, (cursor += count));

  const phraseVectors = take(phrases.length);
  const nameVectors = take(names.length);
  const documentVectors = take(documents.length);
  const seedVectors = take(typeEntries.length);

  const cached = cachedEncoder(
    encoder,
    phrases.map((phrase, index) => [phrase, phraseVectors[index]])
  );

  const spaceIndex = spaces.map((space, index) => ({
    space,
    nameVector: nameVectors[index],
    docVector: documentVectors[index],
  }));

  const typeIndex = typeEntries.map(([type], index) => ({
    type,
    vector: seedVectors[index],
  }));

  return captureText(input, {
    ...options,
    encoder: cached,
    spaceIndex,
    typeIndex,
  });
}
