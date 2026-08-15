import { ULTIMA_DEFAULT_RATING_THRESHOLDS, ULTIMA_MAX_SEATS } from "@/lib/ultima/constants";
import {
  advanceDraft,
  setAutoDraft,
  startDraft,
} from "@/lib/ultima/server/draft";
import { getUltimaDb } from "@/lib/ultima/server/db";

export const PRACTICE_TIMER_SECONDS = 30;
export const PRACTICE_MAX_LIVE_ROOMS = 20;

export const PRACTICE_DRAFT_OPTS = {
  mutatePlayerPool: false,
  skipNotify: true,
  skipAdminLog: true,
  skipPlayerSync: true,
};

function practiceOpts(code) {
  return {
    ...PRACTICE_DRAFT_OPTS,
    eventScope: practiceScope(code),
  };
}

export function practiceScope(code) {
  return `practice:${normalizeRoomCode(code)}`;
}

export function normalizeRoomCode(code) {
  return typeof code === "string" ? code.trim().toUpperCase() : "";
}

export function isValidRoomCode(code) {
  return /^[A-Z2-9]{4}$/.test(normalizeRoomCode(code));
}

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function getPracticeRoom(code) {
  const db = getUltimaDb();
  if (!db) return null;
  const normalized = normalizeRoomCode(code);
  if (!isValidRoomCode(normalized)) return null;

  const { data } = await db
    .from("ultima_practice_rooms")
    .select("*")
    .eq("code", normalized)
    .maybeSingle();

  return data;
}

export async function getPracticeManager(userId, competitionId) {
  const db = getUltimaDb();
  if (!db || !userId || !competitionId) return null;
  const { data } = await db
    .from("ultima_managers")
    .select("*")
    .eq("user_id", userId)
    .eq("competition_id", competitionId)
    .eq("is_bot", false)
    .maybeSingle();
  return data;
}

async function enforceRoomCap(db) {
  const { count } = await db
    .from("ultima_practice_rooms")
    .select("code", { count: "exact", head: true })
    .eq("keep", false);

  if ((count ?? 0) < PRACTICE_MAX_LIVE_ROOMS) return;

  const { data: rooms } = await db
    .from("ultima_practice_rooms")
    .select("code, competition_id, created_at")
    .eq("keep", false)
    .order("created_at", { ascending: true });

  for (const room of rooms ?? []) {
    const { data: state } = await db
      .from("ultima_draft_state")
      .select("state")
      .eq("competition_id", room.competition_id)
      .maybeSingle();

    if (state?.state === "complete" || state?.state === "cancelled") {
      await db.from("ultima_competition").delete().eq("id", room.competition_id);
      const { count: left } = await db
        .from("ultima_practice_rooms")
        .select("code", { count: "exact", head: true })
        .eq("keep", false);
      if ((left ?? 0) < PRACTICE_MAX_LIVE_ROOMS) return;
    }
  }

  const oldest = rooms?.[0];
  if (oldest) {
    await db.from("ultima_competition").delete().eq("id", oldest.competition_id);
  }
}

async function seatHuman({ competitionId, userId, seasonManager }) {
  const db = getUltimaDb();
  const existing = await getPracticeManager(userId, competitionId);
  if (existing) return { ok: true, manager: existing };

  const baseName = seasonManager.team_name ?? "Practice side";
  const attempts = [baseName, `${baseName} 2`.slice(0, 24), `Side ${userId.slice(0, 6)}`];

  for (const teamName of attempts) {
    const { data, error } = await db
      .from("ultima_managers")
      .insert({
        competition_id: competitionId,
        user_id: userId,
        team_name: teamName,
        manager_name: seasonManager.manager_name,
        colour: seasonManager.colour,
        is_bot: false,
        profile_complete: true,
      })
      .select("*")
      .single();

    if (!error && data) return { ok: true, manager: data };
  }

  return { ok: false, code: "UNAVAILABLE" };
}

export async function createPracticeRoom({ userId, seasonManager, solo = true }) {
  const db = getUltimaDb();
  if (!db) return { ok: false, code: "UNAVAILABLE" };

  await enforceRoomCap(db);

  let code = generateRoomCode();
  for (let i = 0; i < 8; i += 1) {
    const existing = await getPracticeRoom(code);
    if (!existing) break;
    code = generateRoomCode();
  }

  const { data: competition, error: compErr } = await db
    .from("ultima_competition")
    .insert({
      season_label: `Practice ${code}`,
      max_seats: ULTIMA_MAX_SEATS,
      timer_seconds: PRACTICE_TIMER_SECONDS,
      rating_thresholds: ULTIMA_DEFAULT_RATING_THRESHOLDS,
      is_active: false,
      kind: "practice",
    })
    .select("id")
    .single();

  if (compErr || !competition) {
    return { ok: false, code: "UNAVAILABLE", message: compErr?.message };
  }

  await db.from("ultima_draft_state").insert({
    competition_id: competition.id,
    state: "lobby",
  });

  const { error: roomErr } = await db.from("ultima_practice_rooms").insert({
    code,
    competition_id: competition.id,
    host_user_id: userId,
    solo,
  });

  if (roomErr) {
    await db.from("ultima_competition").delete().eq("id", competition.id);
    return { ok: false, code: "UNAVAILABLE" };
  }

  const seated = await seatHuman({
    competitionId: competition.id,
    userId,
    seasonManager,
  });
  if (!seated.ok) {
    await db.from("ultima_competition").delete().eq("id", competition.id);
    return seated;
  }

  // Solo used to start the draft in this same request, which meant seating bots
  // and playing out their opening picks before the button released. The room page
  // starts it instead, so creating a room is always cheap.
  return {
    ok: true,
    code,
    competitionId: competition.id,
    managerId: seated.manager.id,
    solo,
  };
}

export async function joinPracticeRoom({ userId, seasonManager, code }) {
  const room = await getPracticeRoom(code);
  if (!room) return { ok: false, code: "INVITE_INVALID" };

  const db = getUltimaDb();
  const { data: state } = await db
    .from("ultima_draft_state")
    .select("state")
    .eq("competition_id", room.competition_id)
    .maybeSingle();

  const existing = await getPracticeManager(userId, room.competition_id);
  if (existing) {
    return { ok: true, code: room.code, competitionId: room.competition_id, managerId: existing.id };
  }

  if (state && state.state !== "lobby") {
    return { ok: false, code: "DRAFT_STARTED", message: "That practice draft already started." };
  }

  const { count } = await db
    .from("ultima_managers")
    .select("id", { count: "exact", head: true })
    .eq("competition_id", room.competition_id)
    .eq("is_bot", false);

  if ((count ?? 0) >= ULTIMA_MAX_SEATS) {
    return { ok: false, code: "LEAGUE_FULL" };
  }

  const seated = await seatHuman({
    competitionId: room.competition_id,
    userId,
    seasonManager,
  });
  if (!seated.ok) return seated;

  return {
    ok: true,
    code: room.code,
    competitionId: room.competition_id,
    managerId: seated.manager.id,
  };
}

export async function startPracticeRoom({ userId, code }) {
  const room = await getPracticeRoom(code);
  if (!room) return { ok: false, code: "INVITE_INVALID" };
  if (room.host_user_id !== userId) {
    return { ok: false, code: "NOT_COMMISSIONER", message: "Only the host can start this room." };
  }

  const db = getUltimaDb();
  const { data: state } = await db
    .from("ultima_draft_state")
    .select("state")
    .eq("competition_id", room.competition_id)
    .maybeSingle();

  if (state?.state === "live") return { ok: true, already: true };
  if (state?.state === "complete") {
    return { ok: false, code: "UNAVAILABLE", message: "Reset the room to draft again." };
  }

  return startDraft(room.competition_id, userId, practiceOpts(room.code));
}

export async function resetPracticeRoom({ userId, code }) {
  const room = await getPracticeRoom(code);
  if (!room) return { ok: false, code: "INVITE_INVALID" };
  if (room.host_user_id !== userId) {
    return { ok: false, code: "NOT_COMMISSIONER", message: "Only the host can reset this room." };
  }

  const db = getUltimaDb();
  const { data: managers } = await db
    .from("ultima_managers")
    .select("id, is_bot")
    .eq("competition_id", room.competition_id);

  const managerIds = (managers ?? []).map((m) => m.id);
  const botIds = (managers ?? []).filter((m) => m.is_bot).map((m) => m.id);

  if (managerIds.length) {
    await db.from("ultima_draft_picks").delete().eq("competition_id", room.competition_id);
    await db.from("ultima_rosters").delete().in("manager_id", managerIds);
    await db.from("ultima_draft_queues").delete().in("manager_id", managerIds);
  }

  if (botIds.length) {
    await db.from("ultima_managers").delete().in("id", botIds);
  }

  await db
    .from("ultima_draft_state")
    .update({
      state: "lobby",
      draft_order: [],
      current_pick: 1,
      turn_expires_at: null,
      started_at: null,
      completed_at: null,
      paused_at: null,
      paused_by: null,
    })
    .eq("competition_id", room.competition_id);

  if (room.solo) {
    return startDraft(room.competition_id, userId, practiceOpts(room.code));
  }

  return { ok: true, reset: true };
}

export async function setPracticeAutoDraft({ userId, code, enabled }) {
  const room = await getPracticeRoom(code);
  if (!room) return { ok: false, code: "INVITE_INVALID" };

  const manager = await getPracticeManager(userId, room.competition_id);
  if (!manager) return { ok: false, code: "UNAVAILABLE" };

  return setAutoDraft(manager.id, enabled, practiceOpts(room.code));
}

export async function expirePracticeTurn(code) {
  const room = await getPracticeRoom(code);
  if (!room) return { ok: false };
  return advanceDraft(room.competition_id, practiceOpts(room.code));
}

export async function listPracticeLobby(code) {
  const room = await getPracticeRoom(code);
  if (!room) return null;

  const db = getUltimaDb();
  const [{ data: state }, { data: managers }] = await Promise.all([
    db
      .from("ultima_draft_state")
      .select("state, current_pick")
      .eq("competition_id", room.competition_id)
      .maybeSingle(),
    db
      .from("ultima_managers")
      .select("id, team_name, is_bot, user_id")
      .eq("competition_id", room.competition_id)
      .order("created_at"),
  ]);

  return {
    code: room.code,
    solo: room.solo,
    keep: Boolean(room.keep),
    hostUserId: room.host_user_id,
    competitionId: room.competition_id,
    state: state?.state ?? "lobby",
    currentPick: state?.current_pick ?? 1,
    humans: (managers ?? []).filter((m) => !m.is_bot),
    bots: (managers ?? []).filter((m) => m.is_bot),
  };
}

export async function setPracticeKeep({ userId, code, keep }) {
  const room = await getPracticeRoom(code);
  if (!room) return { ok: false, code: "INVITE_INVALID" };
  if (room.host_user_id !== userId) {
    return { ok: false, code: "NOT_COMMISSIONER", message: "Only the host can save this room." };
  }

  const db = getUltimaDb();
  const { error } = await db
    .from("ultima_practice_rooms")
    .update({ keep: Boolean(keep) })
    .eq("code", room.code);

  if (error) return { ok: false, code: "UNAVAILABLE", message: error.message };
  return { ok: true, code: room.code, keep: Boolean(keep) };
}

export async function listMyPracticeRooms(userId) {
  const db = getUltimaDb();
  if (!db || !userId) return [];

  const { data: hosted } = await db
    .from("ultima_practice_rooms")
    .select("code, solo, keep, created_at, competition_id, host_user_id")
    .eq("host_user_id", userId)
    .order("created_at", { ascending: false });

  const { data: seats } = await db
    .from("ultima_managers")
    .select("competition_id")
    .eq("user_id", userId)
    .eq("is_bot", false);

  const hostedIds = new Set((hosted ?? []).map((r) => r.competition_id));
  const guestIds = [...new Set((seats ?? []).map((s) => s.competition_id))].filter(
    (id) => !hostedIds.has(id),
  );

  let guests = [];
  if (guestIds.length) {
    const { data } = await db
      .from("ultima_practice_rooms")
      .select("code, solo, keep, created_at, competition_id, host_user_id")
      .in("competition_id", guestIds)
      .order("created_at", { ascending: false });
    guests = data ?? [];
  }

  const rooms = [...(hosted ?? []), ...guests];
  const result = [];

  for (const room of rooms) {
    const { data: state } = await db
      .from("ultima_draft_state")
      .select("state, current_pick")
      .eq("competition_id", room.competition_id)
      .maybeSingle();
    result.push({
      code: room.code,
      solo: room.solo,
      keep: Boolean(room.keep),
      created_at: room.created_at,
      is_host: room.host_user_id === userId,
      state: state?.state ?? "lobby",
      current_pick: state?.current_pick ?? 1,
    });
  }

  return result;
}
