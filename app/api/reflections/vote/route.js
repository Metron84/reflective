import { NextResponse } from "next/server";
import { REFLECTIONS_CATEGORIES, getVotingState, isCategoryOpen } from "@/lib/config";
import { getServiceClient } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth/session";
import { VOTES_COOKIE, findNomineeById } from "@/lib/reflections";
import { signPayload, verifyPayload, saltedHash } from "@/lib/signing";

export const runtime = "nodejs";

// Simple per-IP sliding window. Good enough for v1 on a single
// serverless instance; the DB unique constraints are the real guard.
const RATE_LIMIT = { windowMs: 60_000, max: 10 };
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

function withVoteCookie(response, payload) {
  response.cookies.set(VOTES_COOKIE, signPayload(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 120,
    path: "/",
  });
  return response;
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { category, nomineeId, fingerprint, website } = body ?? {};

  // Honeypot: bots that fill the hidden field get a quiet fake success.
  if (website) return NextResponse.json({ ok: true });

  if (getVotingState() !== "open") {
    return NextResponse.json(
      { ok: false, reason: "voting-closed" },
      { status: 403 }
    );
  }

  if (!isCategoryOpen(category)) {
    return NextResponse.json(
      { ok: false, reason: "category-closed" },
      { status: 403 }
    );
  }

  if (
    typeof category !== "string" ||
    typeof nomineeId !== "string" ||
    typeof fingerprint !== "string" ||
    fingerprint.length < 16 ||
    !REFLECTIONS_CATEGORIES.some((c) => c.slug === category)
  ) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const ip = getClientIp(request);
  if (rateLimited(ip)) {
    return NextResponse.json(
      { ok: false, reason: "rate-limited" },
      { status: 429 }
    );
  }

  // Signed cookie short-circuit, first of the three dedupe layers.
  const cookieState = verifyPayload(request.cookies.get(VOTES_COOKIE)?.value) ?? {
    categories: [],
    picks: {},
  };
  if (cookieState.categories.includes(category)) {
    return NextResponse.json(
      { ok: false, reason: "already-voted", voted: cookieState.categories },
      { status: 409 }
    );
  }

  const supabase = getServiceClient();
  const user = await getSessionUser();
  const userId = user?.id ?? null;

  if (supabase) {
    const { data: nominee } = await supabase
      .from("nominees")
      .select("id, category")
      .eq("id", nomineeId)
      .single();
    if (!nominee || nominee.category !== category) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const { error } = await supabase.from("votes").insert({
      category,
      nominee_id: nomineeId,
      user_id: userId,
      fingerprint_hash: saltedHash(fingerprint),
      ip_hash: saltedHash(ip),
    });

    if (error) {
      // 23505: unique violation, this device or account already voted.
      if (error.code === "23505") {
        const voted = [...cookieState.categories, category];
        const response = NextResponse.json(
          { ok: false, reason: "already-voted", voted },
          { status: 409 }
        );
        return withVoteCookie(response, { ...cookieState, categories: voted });
      }
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  } else {
    // No Supabase configured: never accept real votes in production.
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { ok: false, reason: "unavailable" },
        { status: 503 }
      );
    }
    const nominee = await findNomineeById(nomineeId);
    if (!nominee || nominee.category !== category) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
  }

  const voted = [...cookieState.categories, category];
  const picks = { ...cookieState.picks, [category]: nomineeId };
  const response = NextResponse.json({
    ok: true,
    voted,
    picks,
    simulated: !supabase,
  });
  return withVoteCookie(response, { categories: voted, picks });
}
