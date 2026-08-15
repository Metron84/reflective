import { timingSafeEqual } from "node:crypto";
import { ULTIMA_MAX_SEATS } from "@/lib/ultima/constants";
import {
  countHumanManagers,
  getActiveCompetition,
  getManagerForUser,
  getUltimaDb,
} from "@/lib/ultima/server/db";

function secretsMatch(provided, expected) {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function getJoinPassword() {
  return process.env.ULTIMA_JOIN_PASSWORD?.trim() ?? "";
}

export function isPasswordJoinEnabled() {
  return Boolean(getJoinPassword());
}

export function isValidInviteCode(code) {
  return typeof code === "string" && code.trim().length === 8;
}

export function normalizeInviteCode(code) {
  return typeof code === "string" ? code.trim().toUpperCase() : "";
}

export function matchesJoinPassword(value) {
  const password = getJoinPassword();
  if (!password || typeof value !== "string") return false;
  return secretsMatch(value.trim(), password);
}

/**
 * Join the active competition via shared password (tester gate).
 */
export async function joinWithPassword(userId) {
  const existing = await getManagerForUser(userId);
  if (existing) return { ok: true, managerId: existing.id, already: true };

  const db = getUltimaDb();
  if (!db) return { ok: false, code: "UNAVAILABLE" };

  const competition = await getActiveCompetition();
  if (!competition) return { ok: false, code: "UNAVAILABLE" };

  const humans = await countHumanManagers(competition.id);
  if (humans >= ULTIMA_MAX_SEATS) {
    return { ok: false, code: "LEAGUE_FULL" };
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
      is_bot: false,
      profile_complete: false,
    })
    .select("id")
    .single();

  if (managerErr || !manager) {
    return { ok: false, code: "UNAVAILABLE" };
  }

  await db.from("ultima_events").insert({
    event: "invite_redeemed",
    manager_id: manager.id,
    payload: { method: "password" },
  });

  return { ok: true, managerId: manager.id };
}
