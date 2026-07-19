/**
 * Rate limiting options for The Concierge:
 *
 * 1) In-memory Map (chosen for v1) — same pattern as Reflections vote /
 *    newsletter. Zero deps, fine on a single Node instance / busy Hobby
 *    function. Resets when the instance recycles; not global across regions.
 *
 * 2) Upstash Redis — not in this project today. Add @upstash/ratelimit when
 *    traffic needs a shared counter across serverless isolates.
 *
 * 3) Vercel KV / other Redis — same idea as Upstash.
 */

const RATE_LIMIT = { windowMs: 60_000, max: 8 };
const rateMap = new Map();

/** Write to Melo: 3 submissions per IP per hour (separate from chat). */
const HANDOFF_RATE_LIMIT = { windowMs: 60 * 60_000, max: 3 };
const handoffRateMap = new Map();

export function getClientIp(request) {
  const fwd = request.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "unknown";
}

function hitLimit(map, ip, { windowMs, max }) {
  const now = Date.now();
  const hits = (map.get(ip) ?? []).filter((t) => now - t < windowMs);
  hits.push(now);
  map.set(ip, hits);
  if (map.size > 10_000) map.clear();
  return hits.length > max;
}

/** Chat Concierge: 8 / IP / minute */
export function rateLimited(ip) {
  return hitLimit(rateMap, ip, RATE_LIMIT);
}

/** Handoff form: 3 / IP / hour */
export function handoffRateLimited(ip) {
  return hitLimit(handoffRateMap, ip, HANDOFF_RATE_LIMIT);
}
