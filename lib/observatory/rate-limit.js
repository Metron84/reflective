import { getClientIp } from "@/lib/concierge/rateLimit";
import { NextResponse } from "next/server";

const WINDOW_MS = 10 * 60_000;
const MAX = 60;
const hits = new Map();

/** 60 requests per 10 minutes per IP, shared by every Observatory study route. */
export function observatoryLimited(request) {
  const ip = getClientIp(request);
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((time) => now - time < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 10_000) hits.clear();
  if (recent.length <= MAX) return null;
  return NextResponse.json(
    { error: "Too many tries. Wait a few minutes." },
    { status: 429 },
  );
}
