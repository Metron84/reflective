/**
 * Already-guessed dedupe is scoped to (mode, GST day, person_id).
 * Cookie and signed-in plays must never bleed guesses across modes or days.
 */

export function dedupeScopeKey(mode, day, personId) {
  return `${day}:${mode}:${personId}`;
}

export function guessPersonIdsFromRows(guesses) {
  if (!Array.isArray(guesses)) return [];
  return guesses.map((g) => g.personId).filter(Boolean);
}

export function buildGuessedPersonIdSet(mode, day, sources) {
  const ids = new Set();
  for (const personId of sources.cookiePersonIds ?? []) {
    ids.add(dedupeScopeKey(mode, day, personId));
  }
  for (const personId of sources.dbPersonIds ?? []) {
    ids.add(dedupeScopeKey(mode, day, personId));
  }
  return ids;
}

export function isPersonAlreadyGuessed(mode, day, personId, guessedKeys) {
  if (!personId) return false;
  return guessedKeys.has(dedupeScopeKey(mode, day, personId));
}
