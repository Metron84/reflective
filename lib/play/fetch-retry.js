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

export function routeName(path) {
  const clean = String(path ?? "").split("?")[0];
  const parts = clean.split("/").filter(Boolean);
  return parts.at(-1) || "play";
}

function blankDebug(path, attempts) {
  return {
    route: routeName(path),
    attempts,
    lastStatus: 0,
    lastContentType: "",
    redirected: false,
    body: "",
  };
}

function headerValue(res, name) {
  const value = res?.headers?.get?.(name);
  return value ? String(value).replace(/\s+/g, " ").trim() : "";
}

async function readBody(res) {
  try {
    const source = typeof res.clone === "function" ? res.clone() : res;
    if (typeof source.text !== "function") return "";
    return String(await source.text()).replace(/\s+/g, " ").trim().slice(0, 300);
  } catch {
    return "";
  }
}

async function describe(path, attempts, res) {
  const type = res?.headers?.get?.("content-type") ?? "";
  const body = res ? await readBody(res) : "";
  const debug = {
    route: routeName(path),
    attempts,
    lastStatus: res?.status ?? 0,
    lastContentType: type.split(";")[0].trim(),
    redirected: Boolean(res?.redirected),
    body,
    mitigated: headerValue(res, "x-vercel-mitigated"),
    vercelId: headerValue(res, "x-vercel-id"),
    server: headerValue(res, "server"),
    cfRay: headerValue(res, "cf-ray"),
  };
  const blockedHtml = (res?.status === 403) && !isJsonResponse(res);
  if (blockedHtml || /security checkpoint/i.test(body) || /verifying your browser/i.test(body)) {
    debug.kind = "challenge";
  }
  return debug;
}

/** One muted line for the no-connection dialog, for example "ref answer 200 text/html challenge". */
export function connectionDebugLine(debug) {
  if (!debug) return "";
  const type = debug.lastContentType || "none";
  const bits = ["ref", debug.route || "play", debug.lastStatus ?? 0, type];
  if (debug.kind) bits.push(debug.kind);
  if (debug.mitigated) bits.push(`mitigated=${debug.mitigated}`);
  if (debug.vercelId) bits.push(`vercel=${debug.vercelId}`);
  if (debug.server) bits.push(`server=${debug.server}`);
  if (debug.cfRay) bits.push(`ray=${debug.cfRay}`);
  if (debug.body) bits.push(debug.body);
  return bits.join(" ");
}

function noConnection(debug) {
  return { ok: false, status: 0, data: { error: NO_CONNECTION }, debug };
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
  let lastDebug = blankDebug(path, attempts);

  for (let i = 0; i < attempts; i += 1) {
    const last = i === attempts - 1;
    try {
      const res = await fetchImpl(path, options);
      lastDebug = await describe(path, attempts, res);
      // A checkpoint page is only cleared by a full page load, so retrying it cannot succeed.
      if (lastDebug.kind === "challenge") {
        lastDebug.attempts = i + 1;
        return noConnection(lastDebug);
      }
      if (isJsonResponse(res)) {
        let data = {};
        try {
          data = await res.json();
        } catch {
          if (!last) {
            await sleep(waitMs);
            continue;
          }
          return noConnection(lastDebug);
        }
        return { ok: res.ok, status: res.status, data };
      }
    } catch {
      lastDebug = blankDebug(path, attempts);
    }
    if (!last) await sleep(waitMs);
  }

  return noConnection(lastDebug);
}
