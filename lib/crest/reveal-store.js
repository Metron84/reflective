/**
 * Which Crest leagues a member has revealed. Browser-only, per account, and tied to
 * the Crest result's saved_at so a re-swipe starts the reveals fresh.
 */

export const REVEAL_EVENT = "trf:crest-reveals";

const keyFor = (userId) => `trf.crest.reveals.v1:${userId}`;

/** Raw stored string for useSyncExternalStore snapshots. */
export function revealSnapshot(userId) {
  try {
    return window.localStorage.getItem(keyFor(userId)) ?? "";
  } catch {
    return "";
  }
}

export function subscribeReveals(callback) {
  window.addEventListener(REVEAL_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(REVEAL_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

/** @returns {string[]} competition names revealed for this Crest result */
export function parseRevealed(raw, savedAt) {
  try {
    if (!raw) return [];
    const value = JSON.parse(raw);
    if (!value || value.savedAt !== savedAt || !Array.isArray(value.leagues)) return [];
    return value.leagues.filter((x) => typeof x === "string");
  } catch {
    return [];
  }
}

export function writeRevealed(userId, savedAt, leagues) {
  try {
    window.localStorage.setItem(keyFor(userId), JSON.stringify({ savedAt, leagues }));
  } catch {
    // Storage blocked: the reveal still shows for this visit.
  }
  window.dispatchEvent(new CustomEvent(REVEAL_EVENT));
}
