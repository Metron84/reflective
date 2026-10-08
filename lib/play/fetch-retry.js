/** Shared client fetch for /play. Retries a Vercel browser-check HTML page. */

export const NO_CONNECTION = "No connection. Check your signal and try again.";

const EXTRA_RETRIES = 2;
const WAIT_MS = 1200;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isJsonResponse(res) {
  const type = res.headers?.get?.("content-type") ?? "";
  return type.toLowerCase().includes("application/json");
}

/**
 * Fetch with credentials: "same-origin".
 * Retry only when the body is not JSON or the request throws.
 * A JSON response, including 4xx and 5xx, is returned immediately.
 * "No connection" only after every retry of a non-JSON or network failure.
 */
export async function fetchWithRetry(path, init = {}, opts = {}) {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const waitMs = opts.waitMs ?? WAIT_MS;
  const extra = opts.extraRetries ?? EXTRA_RETRIES;
  const attempts = extra + 1;
  const options = { ...init, credentials: "same-origin" };

  for (let i = 0; i < attempts; i += 1) {
    const last = i === attempts - 1;
    try {
      const res = await fetchImpl(path, options);
      if (isJsonResponse(res)) {
        let data = {};
        try {
          data = await res.json();
        } catch {
          if (!last) {
            await sleep(waitMs);
            continue;
          }
          return { ok: false, status: 0, data: { error: NO_CONNECTION } };
        }
        return { ok: res.ok, status: res.status, data };
      }
    } catch {
      // Network error: retry, then no connection.
    }
    if (!last) await sleep(waitMs);
  }

  return { ok: false, status: 0, data: { error: NO_CONNECTION } };
}
