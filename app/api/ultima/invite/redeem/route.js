import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { ULTIMA_MAX_SEATS } from "@/lib/ultima/constants";
import { ultimaErrorResponse } from "@/lib/ultima/errors";
import {
  countHumanManagers,
  getActiveCompetition,
  getManagerForUser,
  getUltimaDb,
} from "@/lib/ultima/server/db";

export const runtime = "nodejs";

const RATE_LIMIT = { windowMs: 60 * 60_000, max: 5 };
const rateMap = new Map();

function getClientIp(request) {
  const fwd = request.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "unknown";
}

function rateLimited(ip) {
  const now = Date.now();
  const hits = (rateMap.get(ip) ?? []).filter(
    (t) => now - t < RATE_LIMIT.windowMs,
  );
  hits.push(now);
  rateMap.set(ip, hits);
  if (rateMap.size > 10_000) rateMap.clear();
  return hits.length > RATE_LIMIT.max;
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { code: "INVALID", message: "Invalid request." },
      { status: 400 },
    );
  }

  if (body?.website) {
    return NextResponse.json({ ok: true });
  }

  const ip = getClientIp(request);
  if (rateLimited(ip)) {
    return NextResponse.json(
      { code: "RATE_LIMIT", message: "Too many attempts. Try again later." },
      { status: 429 },
    );
  }

  const user = await getSessionUser();
  if (!user) {
    const { status, body: err } = ultimaErrorResponse("SIGN_IN_REQUIRED", {
      status: 401,
    });
    return NextResponse.json(err, { status });
  }

  const existing = await getManagerForUser(user.id);
  if (existing) {
    return NextResponse.json({ ok: true, manager_id: existing.id });
  }

  const code =
    typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
  if (code.length !== 8) {
    const { status, body: err } = ultimaErrorResponse("INVITE_INVALID");
    return NextResponse.json(err, { status });
  }

  const db = getUltimaDb();
  if (!db) {
    const { status, body: err } = ultimaErrorResponse("UNAVAILABLE", {
      status: 503,
    });
    return NextResponse.json(err, { status });
  }

  const competition = await getActiveCompetition();
  if (!competition) {
    const { status, body: err } = ultimaErrorResponse("UNAVAILABLE", {
      status: 503,
    });
    return NextResponse.json(err, { status });
  }

  const humans = await countHumanManagers(competition.id);
  if (humans >= ULTIMA_MAX_SEATS) {
    const { status, body: err } = ultimaErrorResponse("LEAGUE_FULL");
    return NextResponse.json(err, { status });
  }

  const { data: invite, error: inviteErr } = await db
    .from("ultima_invites")
    .select("*")
    .eq("code", code)
    .maybeSingle();

  if (inviteErr || !invite) {
    const { status, body: err } = ultimaErrorResponse("INVITE_INVALID");
    return NextResponse.json(err, { status });
  }

  if (invite.used_by) {
    const { status, body: err } = ultimaErrorResponse("INVITE_INVALID");
    return NextResponse.json(err, { status });
  }

  if (new Date(invite.expires_at).getTime() < Date.now()) {
    const { status, body: err } = ultimaErrorResponse("INVITE_EXPIRED");
    return NextResponse.json(err, { status });
  }

  const { data: draftState } = await db
    .from("ultima_draft_state")
    .select("state")
    .eq("competition_id", competition.id)
    .maybeSingle();

  if (draftState && draftState.state !== "lobby") {
    const { status, body: err } = ultimaErrorResponse("DRAFT_STARTED");
    return NextResponse.json(err, { status });
  }

  const { data: manager, error: managerErr } = await db
    .from("ultima_managers")
    .insert({
      competition_id: competition.id,
      user_id: user.id,
      invite_id: code,
      is_bot: false,
      profile_complete: false,
    })
    .select("id")
    .single();

  if (managerErr || !manager) {
    const { status, body: err } = ultimaErrorResponse("UNAVAILABLE", {
      status: 500,
    });
    return NextResponse.json(err, { status });
  }

  await db
    .from("ultima_invites")
    .update({ used_by: user.id, used_at: new Date().toISOString() })
    .eq("code", code);

  await db.from("ultima_events").insert({
    event: "invite_redeemed",
    manager_id: manager.id,
    payload: { code },
  });

  return NextResponse.json({ ok: true, manager_id: manager.id });
}
