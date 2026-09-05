const TOKEN_RE = /[#/@*]"[^"]*"|"[^"]*"|\S+/g;

export const normalizeWord = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/^[^a-z0-9]+/, "")
    .replace(/[^a-z0-9]+$/, "");

export const normalizePhrase = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export function tokenize(text) {
  const source = typeof text === "string" ? text : "";
  const tokens = [];
  TOKEN_RE.lastIndex = 0;

  let match = TOKEN_RE.exec(source);
  while (match !== null) {
    const raw = match[0];
    const start = match.index;
    const quoted = raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"');
    const inner = quoted ? raw.slice(1, -1) : raw;

    tokens.push({
      index: tokens.length,
      raw,
      text: inner,
      lower: inner.toLowerCase(),
      norm: normalizeWord(inner),
      start,
      end: start + raw.length,
      quoted,
    });

    match = TOKEN_RE.exec(source);
  }

  return tokens;
}

export function joinTokens(tokens, from, to) {
  return tokens
    .slice(from, to + 1)
    .map((token) => token.raw)
    .join(" ");
}

export const words = (tokens, from, to) =>
  tokens.slice(from, to + 1).map((token) => token.norm);
