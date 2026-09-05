export function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  for (let index = 0; index < a.length; index += 1) dot += a[index] * b[index];
  if (dot > 1) return 1;
  if (dot < -1) return -1;
  return dot;
}
