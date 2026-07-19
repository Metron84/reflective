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

export function getClientIp(request) {
  const fwd = request.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "unknown";
}

export function rateLimited(ip) {
  const now = Date.now();
  const hits = (rateMap.get(ip) ?? []).filter(
    (t) => now - t < RATE_LIMIT.windowMs
  );
  hits.push(now);
  rateMap.set(ip, hits);
  if (rateMap.size > 10_000) rateMap.clear();
  return hits.length > RATE_LIMIT.max;
}
