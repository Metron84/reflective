import { shareAuthCookieDomain } from "@/lib/ultima/host";

// The session cookie and its chunks (sb-<ref>-auth-token, sb-<ref>-auth-token.0).
// The PKCE code verifier (sb-<ref>-auth-token-code-verifier) is not matched on
// purpose: the callback needs it to finish the sign-in.
const AUTH_COOKIE = /^sb-.+-auth-token(?:\.\d+)?$/;
const SHARED_DOMAIN = ".thereflectivefootball.com";

export function isAuthCookieName(name) {
  return AUTH_COOKIE.test(name);
}

/** Cookie names in a raw Cookie header, duplicates kept (request.cookies hides them). */
export function cookieNamesIn(header) {
  return String(header ?? "")
    .split(";")
    .map((pair) => pair.split("=")[0].trim())
    .filter(Boolean);
}

export function authCookieNamesIn(header) {
  return [...new Set(cookieNamesIn(header).filter(isAuthCookieName))];
}

/**
 * Auth cookie names sent more than once. A browser only sends two cookies of
 * one name when a host-only copy (set before the shared domain was used) sits
 * next to the shared-domain copy.
 */
export function duplicateAuthCookieNames(header) {
  const seen = new Set();
  const dupes = new Set();
  for (const name of cookieNamesIn(header)) {
    if (!isAuthCookieName(name)) continue;
    if (seen.has(name)) dupes.add(name);
    seen.add(name);
  }
  return [...dupes];
}

function expired(name, { domain, secure }) {
  return [
    `${name}=`,
    "Path=/",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    domain ? `Domain=${domain}` : null,
    secure ? "Secure" : null,
    "SameSite=Lax",
  ]
    .filter(Boolean)
    .join("; ");
}

/**
 * Set-Cookie strings that expire a cookie in every scope it may live in:
 * host-only (no Domain), and on the shared domain when the host uses it.
 * `scope: "host"` expires only the host-only copy and leaves the shared one.
 */
export function expiredCookieHeaders(names, host, { scope = "both" } = {}) {
  const shared = shareAuthCookieDomain(host);
  const out = [];
  for (const name of names) {
    out.push(expired(name, { domain: null, secure: shared }));
    if (shared && scope === "both") {
      out.push(expired(name, { domain: SHARED_DOMAIN, secure: true }));
    }
  }
  return out;
}

/**
 * Append the expiry headers to a response. Call this after every
 * response.cookies.set: ResponseCookies rewrites the whole Set-Cookie header
 * on set(), which would drop anything appended earlier.
 */
export function appendExpiredCookies(response, names, host, options) {
  for (const header of expiredCookieHeaders(names, host, options)) {
    response.headers.append("Set-Cookie", header);
  }
  return response;
}
