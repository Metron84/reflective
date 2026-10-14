/** Client-safe autocomplete for the answer box. No fs, no pool imports. */
import { normalize } from "@/lib/guesser/matching";

/**
 * @typedef {[string, string, string[], string]} NameEntry  [personId, name, aliases, context]
 */

/**
 * Suggestions for what the player has typed. Matches the start of the full name, the start of
 * any name part (so a surname works), the start of an alias, or any 3 letters inside the name.
 * Entries that match at the start of the name come first.
 *
 * @param {NameEntry[]} list
 * @param {string} query
 * @param {number} [limit]
 */
export function filterNames(list, query, limit = 6) {
  const q = normalize(query);
  if (!q) return [];
  const starts = [];
  const rest = [];
  for (const entry of list) {
    const name = normalize(entry[1]);
    const parts = name.split(/\s+/);
    const aliases = (entry[2] ?? []).map(normalize);
    if (name.startsWith(q)) starts.push(entry);
    else if (
      parts.some((t) => t.startsWith(q)) ||
      aliases.some((a) => a.startsWith(q)) ||
      (q.length >= 3 && name.includes(q))
    ) {
      rest.push(entry);
    }
    if (starts.length >= limit) break;
  }
  return [...starts, ...rest].slice(0, limit);
}
