export const PENDING_KEY = "crest:pendingSave";

/** A pending result older than this is dropped, so a stale swipe never overwrites a newer save. */
export const PENDING_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The pending result lives in localStorage, not sessionStorage: a magic link opened in a new
 * tab or window still finds it. sessionStorage is read as a fallback for a tab that wrote it
 * before this change.
 *
 * @param {{answers: {cardId: number, value: 1|0|-1}[], stake?: string|null, scope?: string|null}} ballot
 * @param {number} [now]
 */
export function writePendingSave(ballot, now = Date.now()) {
  try {
    window.localStorage.setItem(PENDING_KEY, JSON.stringify({ ...ballot, at: now }));
  } catch {
    /* ignore quota / private mode */
  }
}

function readFrom(store, now) {
  const raw = store.getItem(PENDING_KEY);
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  if (!parsed || !Array.isArray(parsed.answers)) return null;
  if (typeof parsed.at === "number" && now - parsed.at > PENDING_TTL_MS) return null;
  return parsed;
}

export function readPendingSave(now = Date.now()) {
  for (const pick of [() => window.localStorage, () => window.sessionStorage]) {
    try {
      const found = readFrom(pick(), now);
      if (found) return found;
    } catch {
      /* unavailable or unreadable: try the next store */
    }
  }
  return null;
}

export function clearPendingSave() {
  for (const pick of [() => window.localStorage, () => window.sessionStorage]) {
    try {
      pick().removeItem(PENDING_KEY);
    } catch {
      /* ignore */
    }
  }
}

/**
 * @param {{answers: {cardId: number, value: 1|0|-1}[], stake?: string|null, scope?: string|null}} ballot
 */
export async function saveCrestResult(ballot) {
  const res = await fetch("/api/crest/result", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      answers: ballot.answers,
      stake: ballot.stake || null,
      scope: ballot.scope || null,
      fc: ballot.fc || null,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    return { ok: false, needSignIn: true, message: data.message || "Sign in to save." };
  }
  if (!res.ok) {
    return { ok: false, message: data.message || "Could not save." };
  }
  return { ok: true, result: data };
}

/** Signed-in state and the saved result in one call. 401 means signed out. */
export async function fetchCrestStatus() {
  try {
    const res = await fetch("/api/crest/result", { method: "GET" });
    if (res.status === 401) return { signedIn: false, saved: null };
    if (!res.ok) return { signedIn: null, saved: null };
    const data = await res.json().catch(() => null);
    return { signedIn: true, saved: data?.saved ? data : null };
  } catch {
    return { signedIn: null, saved: null };
  }
}

export async function loadCrestResult() {
  const res = await fetch("/api/crest/result", { method: "GET" });
  if (res.status === 401 || res.status === 404) return null;
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return data?.saved ? data : null;
}
