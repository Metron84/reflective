export const PENDING_KEY = "crest:pendingSave";

/**
 * @param {{answers: {cardId: number, value: 1|0|-1}[], stake?: string|null, scope?: string|null}} ballot
 */
export function writePendingSave(ballot) {
  try {
    window.sessionStorage.setItem(PENDING_KEY, JSON.stringify(ballot));
  } catch {
    /* ignore quota / private mode */
  }
}

export function readPendingSave() {
  try {
    const raw = window.sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.answers)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingSave() {
  try {
    window.sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
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

export async function loadCrestResult() {
  const res = await fetch("/api/crest/result", { method: "GET" });
  if (res.status === 401 || res.status === 404) return null;
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return data?.saved ? data : null;
}
