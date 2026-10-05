/**
 * Browser side of an Ultima write. No React in here, so it runs in tests.
 *
 * One tap makes one key. The key rides on the request as Idempotency-Key, so
 * sending the same write twice can never write twice. After GIVE_UP_AFTER_MS the
 * caller stops waiting and asks the server whether the tap landed.
 */

export const SLOW_AFTER_MS = 2000;
export const GIVE_UP_AFTER_MS = 10_000;
export const POLL_EVERY_MS = 2000;
export const POLL_TRIES = 5;
export const DONE_FOR_MS = 2000;

export const UNCERTAIN_LINE = "Could not confirm that. Check, then try again.";
export const OFFLINE_LINE = "No connection. Try again.";

const TIMEOUT = Symbol("timeout");

export function newActionKey() {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const sleep = (ms) => new Promise((resolve) => setTimeout(() => resolve(TIMEOUT), ms));

function outcome(status, body) {
  const data = body && typeof body === "object" ? body : {};
  const ok = status < 400 && data.ok !== false;
  return {
    ok,
    status,
    body: data,
    code: ok ? null : (data.code ?? "UNAVAILABLE"),
    message: ok ? null : (data.message ?? "That did not go through."),
    uncertain: false,
  };
}

/**
 * Send one write and settle it.
 * Resolves { ok, status, body, code, message, uncertain }. uncertain means the
 * server could not say whether the write landed; send the same key again.
 */
export async function performAction({
  url,
  method = "POST",
  body,
  key,
  fetchImpl = globalThis.fetch,
  giveUpMs = GIVE_UP_AFTER_MS,
  pollMs = POLL_EVERY_MS,
  pollTries = POLL_TRIES,
}) {
  const send = () =>
    fetchImpl(url, {
      method,
      headers: { "Content-Type": "application/json", "Idempotency-Key": key },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        return { status: res.status, body: json };
      })
      .catch(() => ({ netError: true }));

  const settled = (r) => r && r !== TIMEOUT && !r.netError && r.body?.code !== "IN_PROGRESS";

  let inflight = send();
  let first = await Promise.race([inflight, sleep(giveUpMs)]);
  if (settled(first)) return outcome(first.status, first.body);

  // Ten seconds, or the connection dropped: ask the server instead of showing an error.
  for (let i = 0; i < pollTries; i += 1) {
    let status = null;
    try {
      const res = await fetchImpl(`/api/ultima/action-status?key=${encodeURIComponent(key)}`, {
        cache: "no-store",
      });
      status = res.ok ? await res.json() : null;
    } catch {
      status = null;
    }

    if (status?.state === "done") return outcome(status.status, status.body);
    // The server never saw the key. Sending it again is safe.
    if (status?.state === "unknown") inflight = send();

    const next = await Promise.race([inflight, sleep(pollMs)]);
    if (settled(next)) return outcome(next.status, next.body);
    if (next?.netError) inflight = sleep(pollMs);
  }

  return {
    ok: false,
    status: 0,
    body: {},
    code: "UNCERTAIN",
    message: UNCERTAIN_LINE,
    uncertain: true,
  };
}
