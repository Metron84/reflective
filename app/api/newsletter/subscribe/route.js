import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

const RATE_LIMIT = { windowMs: 60_000, max: 5 };
const rateMap = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const hits = (rateMap.get(ip) ?? []).filter(
    (t) => now - t < RATE_LIMIT.windowMs
  );
  hits.push(now);
  rateMap.set(ip, hits);
  if (rateMap.size > 10_000) rateMap.clear();
  return hits.length > RATE_LIMIT.max;
}

function getClientIp(request) {
  const fwd = request.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "unknown";
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, reason: "invalid-request" },
      { status: 400 }
    );
  }

  const { email, consent, website } = body ?? {};

  if (website) return NextResponse.json({ ok: true });

  const ip = getClientIp(request);
  if (rateLimited(ip)) {
    return NextResponse.json(
      { ok: false, reason: "rate-limited" },
      { status: 429 }
    );
  }

  if (typeof email !== "string" || !isValidEmail(email.trim())) {
    return NextResponse.json(
      { ok: false, reason: "invalid-email" },
      { status: 400 }
    );
  }

  if (consent !== true) {
    return NextResponse.json(
      { ok: false, reason: "consent-required" },
      { status: 400 }
    );
  }

  const normalized = email.trim().toLowerCase();
  const supabase = getServiceClient();

  if (!supabase) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { ok: false, reason: "unavailable" },
        { status: 503 }
      );
    }
    return NextResponse.json({ ok: true, simulated: true });
  }

  const { error } = await supabase.from("subscribers").insert({
    email: normalized,
    consent: true,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { ok: false, reason: "already-subscribed" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { ok: false, reason: "server-error" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
