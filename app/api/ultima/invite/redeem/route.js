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
import {
  isValidInviteCode,
  joinWithPassword,
  matchesJoinPassword,
  normalizeInviteCode,
} from "@/lib/ultima/server/join";
import { recordUltimaEvent } from "@/lib/ultima/server/record-event";

export const runtime = "nodejs";

const RATE_LIMIT = { windowMs: 60 * 60_000, max: 10 };
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

async function joinWithInviteCode(userId, code) {
  const existing = await getManagerForUser(userId);
  if (existing) return { ok: true, manager_id: existing.id };

  const db = getUltimaDb();
  if (!db) return { ok: false, code: "UNAVAILABLE" };

  const competition = await getActiveCompetition();
  if (!competition) return { ok: false, code: "UNAVAILABLE" };

  const humans = await countHumanManagers(competition.id);
  if (humans >= ULTIMA_MAX_SEATS) {
    return { ok: false, code: "LEAGUE_FULL" };
  }

  const { data: invite, error: inviteErr } = await db
    .from("ultima_invites")
    .select("*")
    .eq("code", code)
    .maybeSingle();

  if (inviteErr || !invite) {
    return { ok: false, code: "INVITE_INVALID" };
  }

  if (invite.used_by) {
    return { ok: false, code: "INVITE_INVALID" };
  }

  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return { ok: false, code: "INVITE_EXPIRED" };
  }

  const { data: draftState } = await db
    .from("ultima_draft_state")
    .select("state")
    .eq("competition_id", competition.id)
    .maybeSingle();

  if (draftState && draftState.state !== "lobby") {
    return { ok: false, code: "DRAFT_STARTED" };
  }

  const { data: manager, error: managerErr } = await db
    .from("ultima_managers")
    .insert({
      competition_id: competition.id,
      user_id: userId,
      invite_id: code,
      is_bot: false,
      profile_complete: false,
    })
    .select("id")
    .single();

  if (managerErr || !manager) {
    return { ok: false, code: "UNAVAILABLE" };
  }

  await db
    .from("ultima_invites")
    .update({ used_by: userId, used_at: new Date().toISOString() })
    .eq("code", code);

  await recordUltimaEvent({
    event: "invite_redeemed",
    managerId: manager.id,
    competitionId: manager.competition_id,
    payload: { code },
  });

  return { ok: true, manager_id: manager.id };
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

  const password =
    typeof body?.password === "string" ? body.password.trim() : "";
  const code = normalizeInviteCode(body?.code);

  let result;
  if (password) {
    if (!matchesJoinPassword(password)) {
      const { status, body: err } = ultimaErrorResponse("INVITE_INVALID");
      return NextResponse.json(err, { status });
    }
    result = await joinWithPassword(user.id);
  } else if (isValidInviteCode(code)) {
    result = await joinWithInviteCode(user.id, code);
  } else {
    const { status, body: err } = ultimaErrorResponse("INVITE_INVALID");
    return NextResponse.json(err, { status });
  }

  if (!result.ok) {
    const { status, body: err } = ultimaErrorResponse(result.code ?? "UNAVAILABLE", {
      status: result.code === "LEAGUE_FULL" ? 403 : 400,
    });
    return NextResponse.json(err, { status });
  }

  return NextResponse.json({
    ok: true,
    manager_id: result.manager_id ?? result.managerId,
  });
}
