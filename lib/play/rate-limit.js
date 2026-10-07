// In-memory sliding window per IP and route. Per serverless instance, so it is a
// best-effort brake, not a hard global limit.
const hits = new Map();

export function rateLimit(ip, route, limit, windowMs = 60_000, now = Date.now()) {
  const key = `${route}|${ip}`;
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  }
  return true;
}

export function clientIp(headers) {
  const fwd = headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? headers.get("x-real-ip") ?? "unknown").trim();
}
