/**
 * Links for the Programme sign-up and claim flow. Pure, so server and client share them.
 *
 * Every sign-in started from a game CTA lands on the claim step first. The claim step saves
 * whatever the player just earned, then continues to `next` (/account for members, which
 * sends first-timers through /welcome).
 */

export const CLAIM_PATH = "/auth/claim";
export const ACCOUNT_PATH = "/account";

/** The claim step URL, carrying where to go afterwards. */
export function claimHref(next = ACCOUNT_PATH) {
  return `${CLAIM_PATH}?next=${encodeURIComponent(next)}`;
}

/**
 * Sign-up URL for a CTA.
 * `claim` false goes straight to `next` (a game with nothing to claim).
 * `origin` is "" on the main site. A game on its own host passes the main site origin when
 * that host does not serve /signin.
 */
export function programmeSignInHref({ claim = true, next = ACCOUNT_PATH, origin = "" } = {}) {
  const target = claim ? claimHref(next) : next;
  return `${origin}/signin?next=${encodeURIComponent(target)}`;
}

/** Hosts that serve one game and not the rest of the site. */
const SATELLITE = /^(play|watchwith|ultima|observatory)\./i;

export function isSatelliteHost(host) {
  return SATELLITE.test(String(host ?? ""));
}

/**
 * Where the claim step sends the browser. A satellite host does not serve /account, so the
 * path goes to the main site. `mainOrigin` is that site's origin.
 */
export function resolveContinue(next, host, mainOrigin) {
  const path = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : ACCOUNT_PATH;
  return isSatelliteHost(host) ? `${mainOrigin}${path}` : path;
}
