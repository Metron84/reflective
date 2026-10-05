// Client-side core of useUltimaAction. No React, so node tests can drive it.

/** After this long a working action is "slow". */
export const SLOW_MS = 2000;
/** After this long we stop waiting on the write and ask the server what happened. */
export const GIVE_UP_MS = 10000;
const POLL_MS = 2000;
const POLL_TRIES = 8;

const TIMED_OUT = Symbol("timed-out");

export function newActionKey() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function send(fetchImpl, url, body, key) {
  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": key },
      body: JSON.stringify(body ?? {}),
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  } catch {
    return { network: true };
  }
}

/** Ask the server whether a keyed write landed. */
async function checkStatus(fetchImpl, key, pollMs, tries) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const res = await fetchImpl(`/api/ultima/action-status?key=${encodeURIComponent(key)}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (data.state === "done") return { status: data.status ?? 200, data: data.result ?? {} };
      if (data.state === "unknown") return { unknown: true };
    } catch {
      /* keep trying */
    }
    await wait(pollMs);
  }
  return { stillPending: true };
}

/**
 * Send one keyed write and wait for the answer.
 * Calls onSlow() after slowMs. After giveUpMs it stops waiting and asks the
 * server what happened (also when the connection drops or the server says 202).
 * Resolves { status, data } for a definitive answer, { unknown: true } when the
 * server never saw the write, { stillPending: true } when it may yet land.
 */
export async function executeAction({
  url,
  body,
  key,
  onSlow = () => {},
  fetchImpl = (...args) => fetch(...args),
  slowMs = SLOW_MS,
  giveUpMs = GIVE_UP_MS,
  pollMs = POLL_MS,
  pollTries = POLL_TRIES,
}) {
  const slow = setTimeout(onSlow, slowMs);
  let giveUp;
  const limit = new Promise((resolve) => {
    giveUp = setTimeout(() => resolve(TIMED_OUT), giveUpMs);
  });
  try {
    let outcome = await Promise.race([send(fetchImpl, url, body, key), limit]);
    clearTimeout(giveUp);
    const noAnswer = outcome === TIMED_OUT || outcome.network || outcome.status === 202;
    if (noAnswer) outcome = await checkStatus(fetchImpl, key, pollMs, pollTries);
    return outcome;
  } finally {
    clearTimeout(slow);
    clearTimeout(giveUp);
  }
}
