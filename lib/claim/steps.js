/**
 * The four claim steps. Each one uses its game's existing claim path. Dependencies are passed
 * in so the steps run the same in the browser and in tests.
 *
 * - Are You Really a Fan?  POST /api/play/claim, which reads the fq_sid cookie
 * - The Guesser            POST /api/guesser/claim, which reads today's cookie games
 * - Codemaster             POST /api/codemaster/progress with the browser's local progress
 * - The Crest              PUT /api/crest/result with the pending result
 */

/** Statuses that mean "nothing to claim", not "something broke". */
const NOTHING_TO_CLAIM = new Set([404, 409, 410]);

async function postJson(fetchFn, path, body) {
  return fetchFn(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function playStep({ fetch: fetchFn }) {
  return {
    name: "play",
    async run() {
      const res = await postJson(fetchFn, "/api/play/claim");
      if (res.ok) return { claimed: true };
      if (NOTHING_TO_CLAIM.has(res.status)) return { claimed: false };
      throw new Error(`play claim returned ${res.status}`);
    },
  };
}

export function guesserStep({ fetch: fetchFn }) {
  return {
    name: "guesser",
    async run() {
      const res = await postJson(fetchFn, "/api/guesser/claim");
      if (!res.ok) throw new Error(`guesser claim returned ${res.status}`);
      const data = await res.json().catch(() => ({}));
      return { claimed: Array.isArray(data.claimed) && data.claimed.length > 0 };
    },
  };
}

/**
 * @param {{fetch: Function, load: () => {solved: Record<string, unknown>}, save: (p: object) => void}} deps
 */
export function codemasterStep({ fetch: fetchFn, load, save }) {
  return {
    name: "codemaster",
    async run() {
      const local = load();
      if (!local || Object.keys(local.solved ?? {}).length === 0) return { claimed: false };
      const res = await postJson(fetchFn, "/api/codemaster/progress", { local });
      if (!res.ok) throw new Error(`codemaster claim returned ${res.status}`);
      const data = await res.json().catch(() => ({}));
      if (data.signedIn && data.progress) save(data.progress);
      return { claimed: Boolean(data.signedIn) };
    },
  };
}

/**
 * @param {{read: () => object|null, save: (ballot: object) => Promise<{ok: boolean, needSignIn?: boolean}>, clear: () => void}} deps
 */
export function crestStep({ read, save, clear }) {
  return {
    name: "crest",
    async run() {
      const pending = read();
      if (!pending) return { claimed: false };
      const put = await save(pending);
      if (put.ok) {
        clear();
        return { claimed: true };
      }
      // Not signed in, or the save failed. Keep it so the next try can use it.
      throw new Error(put.needSignIn ? "not signed in" : "crest save failed");
    },
  };
}
