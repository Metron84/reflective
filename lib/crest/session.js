/**
 * Clears quiz state left in the browser. The swipe hint is not a run.
 */

const HINT_KEY = "crest:hintSeen";

export function clearCrestRunStorage() {
  wipe(window.localStorage);
  wipe(window.sessionStorage);
}

/**
 * @param {Storage} store
 */
function wipe(store) {
  try {
    const keys = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key && key.startsWith("crest:") && key !== HINT_KEY) keys.push(key);
    }
    for (const key of keys) store.removeItem(key);
  } catch {
    /* private mode */
  }
}
