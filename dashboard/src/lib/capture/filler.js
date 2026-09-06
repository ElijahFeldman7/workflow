const compact = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const CARRIER_PHRASES = [
  "can you remind me to",
  "can you remind me about",
  "can you remind me",
  "i am supposed to",
  "im supposed to",
  "i have got to",
  "i have to do",
  "i need to do",
  "i want to do",
  "do not forget to",
  "do not forget about",
  "dont forget to",
  "dont forget about",
  "note to self to",
  "make sure that i",
  "i have got",
  "ive got to",
  "ive gotta",
  "i got to do",
  "i gotta do",
  "we need to do",
  "we have to do",
  "note to self",
  "dont forget",
  "do not forget",
  "make sure to",
  "make sure i",
  "remind me to",
  "remind me about",
  "i have to",
  "i need to",
  "i want to",
  "i going to",
  "im going to",
  "i am going to",
  "we have to",
  "we need to",
  "have to do",
  "need to do",
  "got to do",
  "gotta do",
  "ive got",
  "i gotta",
  "i got to",
  "i should",
  "i must",
  "i wanna",
  "there is",
  "there are",
  "we have",
  "we need",
  "i have",
  "i need",
  "i want",
  "remind me",
  "remember to",
  "make sure",
  "have to",
  "need to",
  "got to",
  "going to",
  "theres",
  "gotta",
  "gonna",
  "please",
  "remember",
  "todo",
  "to do",
].map((phrase) => phrase.split(" ").map(compact));

// Longest phrase first so "i have to" wins over "i have".
const PREFIXES = [...CARRIER_PHRASES].sort((a, b) => b.length - a.length);

const DETERMINERS = new Set(["a", "an", "the", "my", "our", "your", "some"]);

const matchesAt = (tokens, start, phrase) => {
  if (start + phrase.length > tokens.length) return false;
  return phrase.every(
    (word, offset) => compact(tokens[start + offset].norm) === word
  );
};

// Index of the first token that carries real meaning.
export function fillerBoundary(tokens) {
  let start = 0;
  let moved = true;

  while (moved && start < tokens.length) {
    moved = false;

    const phrase = PREFIXES.find((candidate) =>
      matchesAt(tokens, start, candidate)
    );
    if (phrase) {
      start += phrase.length;
      moved = true;
      continue;
    }

    if (DETERMINERS.has(compact(tokens[start].norm))) {
      start += 1;
      moved = true;
    }
  }

  return start;
}
