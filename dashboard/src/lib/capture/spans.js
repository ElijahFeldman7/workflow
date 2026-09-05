export function makeSpan(field, value, from, to, confidence, extra) {
  return { field, value, from, to, confidence, ...(extra || {}) };
}

const overlaps = (a, b) => a.from <= b.to && b.from <= a.to;

export function selectSpans(spans, options = {}) {
  const singleValue = options.singleValue !== false;
  const ranked = [...spans].sort(
    (a, b) =>
      b.confidence - a.confidence ||
      b.to - b.from - (a.to - a.from) ||
      b.from - a.from
  );

  const accepted = [];
  const takenFields = new Set();

  ranked.forEach((span) => {
    if (singleValue && takenFields.has(span.field)) return;
    if (accepted.some((other) => overlaps(other, span))) return;
    accepted.push(span);
    takenFields.add(span.field);
  });

  return accepted.sort((a, b) => a.from - b.from);
}

export function coveredIndices(spans) {
  const covered = new Set();
  spans.forEach((span) => {
    for (let index = span.from; index <= span.to; index += 1) covered.add(index);
  });
  return covered;
}

export function spansByField(spans) {
  const map = {};
  spans.forEach((span) => {
    if (map[span.field] === undefined) map[span.field] = span;
  });
  return map;
}
