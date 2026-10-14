/**
 * Typing tolerance for the answer box. Pure and client-safe.
 * Inputs are expected to be normalised already (lowercase, no accents or punctuation).
 */

/** True when a and b differ by at most one inserted, deleted or replaced character. */
export function withinOneEdit(a, b) {
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0;
  while (i < la && i < lb && a[i] === b[i]) i += 1;
  if (la === lb) return a.slice(i + 1) === b.slice(i + 1); // one replacement
  const [short, long] = la < lb ? [a, b] : [b, a];
  return short.slice(i) === long.slice(i + 1); // one insertion or deletion
}

/** Keys shorter than this must match exactly: one edit on "xavi" would reach "xabi", a different player. */
export const MIN_FUZZY_LENGTH = 5;
