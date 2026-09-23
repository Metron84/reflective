import {
  PRACTICE_MIN_SEATS,
  ULTIMA_DEFAULT_RATING_THRESHOLDS,
  ULTIMA_MAX_SEATS,
} from "@/lib/ultima/constants";
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
  skipBotChain: false,
  maxBotPicks: 20,
  skipHumanExpiry: true,
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

function clampSeatCap(value, humanCount = 1) {
  const raw = Number(value);
  const floor = Math.max(PRACTICE_MIN_SEATS, humanCount || 1);
  if (!Number.isFinite(raw)) return Math.max(floor, ULTIMA_MAX_SEATS);
  return Math.min(ULTIMA_MAX_SEATS, Math.max(floor, raw));
}

async function getCompetitionSeatCap(competitionId) {
  const db = getUltimaDb();
  const { data } = await db
    .from("ultima_competition")
    .select("max_seats")
    .eq("id", competitionId)
    .maybeSingle();
  return clampSeatCap(data?.max_seats ?? ULTIMA_MAX_SEATS);
}

async function firstFreeSlot(competitionId, cap) {
  const db = getUltimaDb();
  const { data } = await db
    .from("ultima_managers")
    .select("draft_slot")
    .eq("competition_id", competitionId);
  const taken = new Set(
    (data ?? [])
      .map((row) => Number(row.draft_slot))
      .filter((slot) => slot >= 1 && slot <= cap),
  );
  for (let slot = 1; slot <= cap; slot += 1) {
    if (!taken.has(slot)) return slot;
  }
  return null;
}

async function trimBotsToCap(competitionId, cap) {
  const db = getUltimaDb();
  const { data: managers } = await db
    .from("ultima_managers")
    .select("id, is_bot, draft_slot")
    .eq("competition_id", competitionId);

  const humans = (managers ?? []).filter((row) => !row.is_bot);
  const bots = (managers ?? []).filter((row) => row.is_bot);
  const drop = [];

  for (const bot of bots) {
    const slot = Number(bot.draft_slot);
    if (!slot || slot > cap) drop.push(bot.id);
  }

  let remaining = bots.length - drop.length;
  for (const bot of bots) {
    if (humans.length + remaining <= cap) break;
    if (drop.includes(bot.id)) continue;
    drop.push(bot.id);
    remaining -= 1;
  }

  if (drop.length) {
    await db.from("ultima_managers").delete().in("id", drop);
  }
}

async function ensureHumanSlots(competitionId, cap) {
  const db = getUltimaDb();
  const { data: humans } = await db
    .from("ultima_managers")
    .select("id, draft_slot")
    .eq("competition_id", competitionId)
    .eq("is_bot", false)
    .order("created_at");

  const taken = new Set();
  const needsSlot = [];
  for (const human of humans ?? []) {
    const slot = Number(human.draft_slot);
    if (slot >= 1 && slot <= cap && !taken.has(slot)) {
      taken.add(slot);
    } else {
      needsSlot.push(human);
    }
  }

  for (const human of needsSlot) {
    let slot = null;
    for (let s = 1; s <= cap; s += 1) {
      if (!taken.has(s)) {
        slot = s;
        break;
      }
    }
    if (!slot) break;
    taken.add(slot);
    await db.from("ultima_managers").update({ draft_slot: slot }).eq("id", human.id);
  }
}

async function seatHuman({ competitionId, userId, seasonManager, cap = ULTIMA_MAX_SEATS }) {
  const db = getUltimaDb();
  const existing = await getPracticeManager(userId, competitionId);
  if (existing) return { ok: true, manager: existing };

  const draftSlot = await firstFreeSlot(competitionId, cap);
  if (!draftSlot) return { ok: false, code: "LEAGUE_FULL" };

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
        auto_draft: false,
        profile_complete: true,
        draft_slot: draftSlot,
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
    cap: ULTIMA_MAX_SEATS,
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

  const cap = await getCompetitionSeatCap(room.competition_id);
  const { count } = await db
    .from("ultima_managers")
    .select("id", { count: "exact", head: true })
    .eq("competition_id", room.competition_id)
    .eq("is_bot", false);

  if ((count ?? 0) >= cap) {
    return { ok: false, code: "LEAGUE_FULL" };
  }

  const seated = await seatHuman({
    competitionId: room.competition_id,
    userId,
    seasonManager,
    cap,
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

  await clearPracticeHumanAuto(room.competition_id);
  const seatCount = await getCompetitionSeatCap(room.competition_id);
  await ensureHumanSlots(room.competition_id, seatCount);
  await trimBotsToCap(room.competition_id, seatCount);
  return startDraft(room.competition_id, userId, {
    ...practiceOpts(room.code),
    keepOrder: true,
    seatCount,
  });
}

export async function setPracticeLobby({ userId, code, seatsCap, mySlot }) {
  const room = await getPracticeRoom(code);
  if (!room) return { ok: false, code: "INVITE_INVALID" };
  if (room.host_user_id !== userId) {
    return { ok: false, code: "NOT_COMMISSIONER", message: "Only the host can set the lobby." };
  }

  const db = getUltimaDb();
  const { data: state } = await db
    .from("ultima_draft_state")
    .select("state")
    .eq("competition_id", room.competition_id)
    .maybeSingle();

  if (state && state.state !== "lobby") {
    return { ok: false, code: "DRAFT_STARTED", message: "The draft already started." };
  }

  const { data: humans } = await db
    .from("ultima_managers")
    .select("id, user_id, draft_slot")
    .eq("competition_id", room.competition_id)
    .eq("is_bot", false)
    .order("created_at");

  const humanCount = (humans ?? []).length || 1;
  const cap = clampSeatCap(seatsCap ?? (await getCompetitionSeatCap(room.competition_id)), humanCount);

  await db
    .from("ultima_competition")
    .update({ max_seats: cap })
    .eq("id", room.competition_id);

  await trimBotsToCap(room.competition_id, cap);
  await ensureHumanSlots(room.competition_id, cap);

  if (mySlot != null) {
    const target = Math.min(cap, Math.max(1, Number(mySlot) || 1));
    const { data: current } = await db
      .from("ultima_managers")
      .select("id, user_id, draft_slot")
      .eq("competition_id", room.competition_id)
      .eq("is_bot", false);

    const host = (current ?? []).find((row) => row.user_id === userId);
    if (host) {
      const occupant = (current ?? []).find(
        (row) => Number(row.draft_slot) === target && row.id !== host.id,
      );
      if (occupant) {
        await db
          .from("ultima_managers")
          .update({ draft_slot: host.draft_slot || target })
          .eq("id", occupant.id);
      }
      await db.from("ultima_managers").update({ draft_slot: target }).eq("id", host.id);
    }
  }

  const lobby = await listPracticeLobby(room.code);
  return { ok: true, ...lobby };
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
    await clearPracticeHumanAuto(room.competition_id);
    const seatCount = await getCompetitionSeatCap(room.competition_id);
    await ensureHumanSlots(room.competition_id, seatCount);
    await trimBotsToCap(room.competition_id, seatCount);
    return startDraft(room.competition_id, userId, {
      ...practiceOpts(room.code),
      keepOrder: true,
      seatCount,
    });
  }

  return { ok: true, reset: true };
}

async function clearPracticeHumanAuto(competitionId) {
  const db = getUltimaDb();
  if (!db || !competitionId) return;
  await db
    .from("ultima_managers")
    .update({ auto_draft: false })
    .eq("competition_id", competitionId)
    .eq("is_bot", false);
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
  const seatsCap = await getCompetitionSeatCap(room.competition_id);
  await ensureHumanSlots(room.competition_id, seatsCap);

  const [{ data: state }, { data: managers }] = await Promise.all([
    db
      .from("ultima_draft_state")
      .select("state, current_pick")
      .eq("competition_id", room.competition_id)
      .maybeSingle(),
    db
      .from("ultima_managers")
      .select("id, team_name, is_bot, user_id, draft_slot")
      .eq("competition_id", room.competition_id)
      .order("draft_slot"),
  ]);

  const humans = (managers ?? []).filter((m) => !m.is_bot);
  const bots = (managers ?? []).filter((m) => m.is_bot);
  const bySlot = new Map();
  for (const manager of managers ?? []) {
    const slot = Number(manager.draft_slot);
    if (slot >= 1 && slot <= seatsCap && !bySlot.has(slot)) {
      bySlot.set(slot, manager);
    }
  }

  const seats = Array.from({ length: seatsCap }, (_, index) => {
    const slot = index + 1;
    const seat = bySlot.get(slot);
    if (!seat || seat.is_bot) {
      return {
        slot,
        team_name: seat?.team_name || "Bot",
        bot: true,
        managerId: seat?.id ?? null,
        userId: null,
      };
    }
    return {
      slot,
      team_name: seat.team_name || "Club",
      bot: false,
      managerId: seat.id,
      userId: seat.user_id,
    };
  });

  return {
    code: room.code,
    solo: room.solo,
    keep: Boolean(room.keep),
    hostUserId: room.host_user_id,
    competitionId: room.competition_id,
    state: state?.state ?? "lobby",
    currentPick: state?.current_pick ?? 1,
    seatsCap,
    humans,
    bots,
    seats,
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
    const [{ data: state }, { count }] = await Promise.all([
      db
        .from("ultima_draft_state")
        .select("state, current_pick, updated_at, started_at, completed_at")
        .eq("competition_id", room.competition_id)
        .maybeSingle(),
      db
        .from("ultima_managers")
        .select("id", { count: "exact", head: true })
        .eq("competition_id", room.competition_id),
    ]);
    result.push({
      code: room.code,
      solo: room.solo,
      keep: Boolean(room.keep),
      created_at: room.created_at,
      is_host: room.host_user_id === userId,
      state: state?.state ?? "lobby",
      current_pick: state?.current_pick ?? 1,
      seats_filled: count ?? 0,
      seats_cap: await getCompetitionSeatCap(room.competition_id),
      last_activity:
        state?.completed_at ?? state?.started_at ?? state?.updated_at ?? room.created_at,
    });
  }

  result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return result;
}

/**
 * Delete a practice room the user hosts. Refuses season competitions.
 */
export async function deletePracticeRoom({ userId, code }) {
  const room = await getPracticeRoom(code);
  if (!room) return { ok: false, code: "INVITE_INVALID" };
  if (room.host_user_id !== userId) {
    return { ok: false, code: "NOT_COMMISSIONER", message: "Only the host can delete this room." };
  }

  const db = getUltimaDb();
  const { data: competition } = await db
    .from("ultima_competition")
    .select("id, kind")
    .eq("id", room.competition_id)
    .maybeSingle();

  if (!competition) return { ok: false, code: "UNAVAILABLE" };
  if (competition.kind !== "practice") {
    return {
      ok: false,
      code: "INVALID",
      message: "Season competitions cannot be deleted from practice.",
    };
  }

  const { error } = await db.from("ultima_competition").delete().eq("id", competition.id);
  if (error) return { ok: false, code: "UNAVAILABLE", message: error.message };
  return { ok: true, code: room.code, deleted: true };
}

/**
 * Delete every saved practice room the user hosts. Season-safe.
 */
export async function deleteAllMyPracticeRooms({ userId }) {
  const db = getUltimaDb();
  if (!db || !userId) return { ok: false, code: "UNAVAILABLE" };

  const { data: hosted } = await db
    .from("ultima_practice_rooms")
    .select("code, competition_id, keep")
    .eq("host_user_id", userId)
    .eq("keep", true);

  const deleted = [];
  for (const room of hosted ?? []) {
    const { data: competition } = await db
      .from("ultima_competition")
      .select("id, kind")
      .eq("id", room.competition_id)
      .maybeSingle();

    if (!competition || competition.kind !== "practice") continue;

    const { error } = await db.from("ultima_competition").delete().eq("id", competition.id);
    if (!error) deleted.push(room.code);
  }

  return { ok: true, deleted, count: deleted.length };
}
