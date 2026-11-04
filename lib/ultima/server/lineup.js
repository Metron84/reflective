import {
  emptyLineupTemplate,
  validateXiFloors,
  isXiComplete,
  canPlaceInSlot,
} from "@/lib/ultima/lineup/slots";
import { xvSlotLocked } from "@/lib/ultima/lineup/lock";
import { ULTIMA_SQUAD_SIZE } from "@/lib/ultima/constants";
import {
  MATCHDAY_DONE,
  MATCHDAY_UPCOMING,
  isMatchdayLocked,
} from "@/lib/ultima/matchday-state";
import { planCaptainChange, reconcileCaptains, resolveCaptains } from "@/lib/ultima/captains";
import { getNextGameweek } from "@/lib/ultima/server/bootstrap";
import { publishUltimaEvent } from "@/lib/ultima/server/events";
import { getGameweekLeagueStates } from "@/lib/ultima/server/matchday-state";
import { recordUltimaEvent } from "@/lib/ultima/server/record-event";
import { getLoggedDb, getReadDb } from "@/lib/ultima/server/strict-db";

export async function getManagerRoster(managerId) {
  const db = getReadDb();
  if (!db) return [];

  const { data } = await db
    .from("ultima_rosters")
    .select("player_id, ultima_players(*)")
    .eq("manager_id", managerId);

  return (data ?? []).map((r) => r.ultima_players).filter(Boolean);
}

export async function getLineup(managerId, gameweekId) {
  const db = getReadDb();
  if (!db) return emptyLineupTemplate();

  const { data } = await db
    .from("ultima_lineups")
    .select("*")
    .eq("manager_id", managerId)
    .eq("gameweek_id", gameweekId);

  if (!data?.length) return emptyLineupTemplate();

  const bySlot = new Map(data.map((r) => [r.slot, r]));
  return emptyLineupTemplate().map((t) => {
    const row = bySlot.get(t.slot);
    return row
      ? {
          slot: row.slot,
          slot_group: row.slot_group,
          player_id: row.player_id,
          locked_at: row.locked_at,
          auto_started: row.auto_started,
          is_captain: Boolean(row.is_captain),
          captain_off: Boolean(row.captain_off),
        }
      : t;
  });
}

/**
 * One manager's captains in the gameweek before this one, { league: player id }.
 * Empty before migration 0051 or in gameweek 1.
 */
export async function getPrevCaptains(managerId, gameweek) {
  const db = getReadDb();
  if (!db || !gameweek?.number || gameweek.number <= 1) return {};
  const { data: prev } = await db
    .from("ultima_gameweeks")
    .select("id")
    .eq("competition_id", gameweek.competition_id)
    .eq("number", gameweek.number - 1)
    .maybeSingle();
  if (!prev?.id) return {};
  const { data, error } = await db
    .from("ultima_lineups")
    .select("slot_group, player_id")
    .eq("manager_id", managerId)
    .eq("gameweek_id", prev.id)
    .eq("is_captain", true);
  if (error) return {};
  return Object.fromEntries((data ?? []).map((r) => [r.slot_group, r.player_id]));
}

/** An XV with the resolved captains flagged, carry-over included. */
export function withResolvedCaptains(lineup, prevCaptains) {
  const { byLeague } = resolveCaptains(lineup, prevCaptains);
  return {
    byLeague,
    lineup: (lineup ?? []).map((r) => ({
      ...r,
      is_captain: Boolean(r.player_id) && byLeague[r.slot_group] === r.player_id,
    })),
  };
}

/** True when the league matchday state freezes the current gameweek's XV. */
export function isLeagueLocked(leagueState) {
  return isMatchdayLocked(leagueState);
}

/** Copy current XV into the next gameweek when it has no players yet. */
async function seedNextLineupFromCurrent(db, managerId, currentGwId, nextGwId) {
  const next = await getLineup(managerId, nextGwId);
  if (next.some((r) => r.player_id)) return next;
  const current = await getLineup(managerId, currentGwId);
  for (const row of current) {
    await db.from("ultima_lineups").upsert(
      {
        manager_id: managerId,
        gameweek_id: nextGwId,
        slot: row.slot,
        slot_group: row.slot_group,
        player_id: row.player_id,
        locked_at: null,
        auto_started: false,
        is_captain: Boolean(row.is_captain),
        captain_off: Boolean(row.captain_off),
      },
      { onConflict: "manager_id,gameweek_id,slot" },
    );
  }
  return getLineup(managerId, nextGwId);
}

async function upsertLineupRows(db, managerId, gameweekId, rows, { stampLocked = false } = {}) {
  const lockedAt = stampLocked ? new Date().toISOString() : null;
  for (const row of rows) {
    await db.from("ultima_lineups").upsert(
      {
        manager_id: managerId,
        gameweek_id: gameweekId,
        slot: row.slot,
        slot_group: row.slot_group,
        player_id: row.player_id,
        locked_at: row.player_id && stampLocked ? lockedAt : null,
        auto_started: row.auto_started ?? false,
      },
      { onConflict: "manager_id,gameweek_id,slot" },
    );
  }
}

/**
 * Save XV. LOCKED/LIVE leagues refuse changes on the current gameweek.
 * DONE leagues write to the next gameweek (seeded from current). UPCOMING
 * writes to the current gameweek. Scoring always reads the gameweek's own rows.
 */
export async function saveLineup({
  managerId,
  gameweekId,
  slots,
  gameweek,
}) {
  const db = getLoggedDb("lineup");
  if (!db || !gameweek) return { ok: false, code: "UNAVAILABLE" };

  const roster = await getManagerRoster(managerId);
  const rosterIds = new Set(roster.map((p) => p.id));
  const playersById = new Map(roster.map((p) => [p.id, p]));

  const lineup = slots.map((s) => ({
    slot: s.slot,
    slot_group: s.slot_group,
    player_id: s.player_id || null,
    locked_at: null,
    auto_started: false,
  }));

  for (const row of lineup) {
    if (row.player_id && !rosterIds.has(row.player_id)) {
      return { ok: false, code: "FLOOR_VIOLATION", message: "That player is not on your squad." };
    }
  }

  for (const row of lineup) {
    if (!row.player_id) continue;
    const player = playersById.get(row.player_id);
    if (player && !canPlaceInSlot(player, row.slot_group)) {
      return {
        ok: false,
        code: "FLOOR_VIOLATION",
        message: `${player.name} cannot fill that slot. League must match.`,
      };
    }
  }

  const { states } = await getGameweekLeagueStates(gameweek.competition_id, gameweekId);
  const existing = await getLineup(managerId, gameweekId);

  for (const row of lineup) {
    const state = states[row.slot_group] ?? MATCHDAY_UPCOMING;
    if (!isLeagueLocked(state)) continue;
    const prev = existing.find((e) => e.slot === row.slot);
    if ((prev?.player_id ?? null) !== (row.player_id ?? null)) {
      return { ok: false, code: "LEAGUE_LOCKED" };
    }
  }

  const floorCheck = validateXiFloors(lineup, playersById);
  if (!floorCheck.ok && isXiComplete(lineup)) {
    return { ok: false, code: "FLOOR_VIOLATION", message: floorCheck.reason };
  }

  const upcomingRows = lineup.filter(
    (r) => (states[r.slot_group] ?? MATCHDAY_UPCOMING) === MATCHDAY_UPCOMING,
  );
  const doneRows = lineup.filter((r) => states[r.slot_group] === MATCHDAY_DONE);

  if (upcomingRows.length) {
    await upsertLineupRows(db, managerId, gameweekId, upcomingRows);
    await keepCaptains(db, managerId, gameweekId, existing, lineup);
  }

  // Freeze unchanged LOCKED/LIVE slots on the current gameweek (scored lineup).
  const lockedRows = existing.filter((r) => isLeagueLocked(states[r.slot_group]));
  if (lockedRows.some((r) => r.player_id && !r.locked_at)) {
    await upsertLineupRows(db, managerId, gameweekId, lockedRows, { stampLocked: true });
  }

  let wroteNext = null;
  if (doneRows.length) {
    const nextGw = await getNextGameweek(gameweek.competition_id, gameweek.number);
    if (!nextGw) {
      return { ok: false, code: "LEAGUE_LOCKED", message: "That league is done. The next gameweek is not open yet." };
    }
    const nextExisting = await seedNextLineupFromCurrent(db, managerId, gameweekId, nextGw.id);
    await upsertLineupRows(db, managerId, nextGw.id, doneRows);
    await keepCaptains(db, managerId, nextGw.id, nextExisting, [
      ...nextExisting.filter((r) => states[r.slot_group] !== MATCHDAY_DONE),
      ...doneRows,
    ]);
    wroteNext = nextGw.id;
  }

  await recordUltimaEvent({
    event: "xi_saved",
    managerId,
    payload: { gameweek_id: gameweekId, next_gameweek_id: wroteNext },
  });

  publishUltimaEvent("lineup.lock", {
    manager_id: managerId,
    gameweek_id: wroteNext ?? gameweekId,
  });

  return { ok: true, gameweekId: wroteNext ?? gameweekId, wroteNext: Boolean(wroteNext) };
}

/**
 * Re-flag a captain who is still in the XV in his country after a save moved
 * him between slots. Best effort: before migration 0051 there is no flag.
 */
async function keepCaptains(db, managerId, gameweekId, before, after) {
  if (!before.some((r) => r.is_captain)) return;
  const wanted = reconcileCaptains(before, after);
  for (const row of wanted) {
    if (!row.is_captain) continue;
    const { error } = await db
      .from("ultima_lineups")
      .update({ is_captain: true })
      .eq("manager_id", managerId)
      .eq("gameweek_id", gameweekId)
      .eq("slot", row.slot);
    if (error) console.error("[ultima/lineup] keep captain failed", error.message);
  }
}

/**
 * Make a player his country's captain. One tap replaces the old captain.
 * LOCKED/LIVE refuse. DONE writes to the next gameweek. Returns { ok, code?, league?, captains? }.
 */
export async function setCaptain({ managerId, gameweekId, gameweek, playerId }) {
  const db = getLoggedDb("lineup");
  if (!db) return { ok: false, code: "CAPTAIN_UNAVAILABLE" };
  if (!gameweek) return { ok: false, code: "NO_GAMEWEEK" };

  const { states } = await getGameweekLeagueStates(gameweek.competition_id, gameweekId);
  const lineup = await getLineup(managerId, gameweekId);
  const row = lineup.find((r) => r.player_id && r.player_id === playerId);
  const league = row?.slot_group;
  const leagueState = league ? states[league] : MATCHDAY_UPCOMING;

  let targetGwId = gameweekId;
  let targetLineup = lineup;
  if (leagueState === MATCHDAY_DONE) {
    const nextGw = await getNextGameweek(gameweek.competition_id, gameweek.number);
    if (!nextGw) return { ok: false, code: "CAPTAIN_LOCKED" };
    targetLineup = await seedNextLineupFromCurrent(db, managerId, gameweekId, nextGw.id);
    targetGwId = nextGw.id;
  }

  const plan = planCaptainChange({
    lineup: targetLineup,
    playerId,
    gameweek,
    leagueState: leagueState === MATCHDAY_DONE ? MATCHDAY_UPCOMING : leagueState,
  });
  if (!plan.ok) return plan;

  if (!plan.noop) {
    const { data, error } = await db.rpc("ultima_set_captain", {
      p_manager_id: managerId,
      p_gameweek_id: targetGwId,
      p_player_id: playerId,
    });
    if (error) {
      console.error("[ultima/lineup] set captain failed", error.message);
      return { ok: false, code: "CAPTAIN_UNAVAILABLE" };
    }
    if (data && data.ok === false) return { ok: false, code: data.code ?? "CAPTAIN_UNAVAILABLE" };
  }

  if (!plan.noop) {
    await recordUltimaEvent({
      event: "captain_set",
      managerId,
      payload: { gameweek_id: targetGwId, player_id: playerId, league: plan.league },
    });
  }

  return {
    ok: true,
    league: plan.league,
    captains: resolveCaptains(plan.lineup).byLeague,
    gameweekId: targetGwId,
  };
}

export async function ensureLineupExists(managerId, gameweekId) {
  const db = getLoggedDb("lineup");
  const existing = await getLineup(managerId, gameweekId);
  const hasRows = existing.some((r) => r.player_id);
  if (hasRows) return existing;

  const template = emptyLineupTemplate();
  for (const row of template) {
    await db.from("ultima_lineups").upsert(
      {
        manager_id: managerId,
        gameweek_id: gameweekId,
        slot: row.slot,
        slot_group: row.slot_group,
        player_id: null,
      },
      { onConflict: "manager_id,gameweek_id,slot" },
    );
  }
  return template;
}

/**
 * Empties a player's XV slots in gameweeks that are not scored yet, in leagues
 * that have not opened their matchday. Locked slots keep the player, so that
 * gameweek's points stay with the owner who had him. Used by drop, add with
 * drop, and trade execution (inside ultima_execute_trade).
 */
export async function clearLineupSlots(managerId, playerIds) {
  const db = getLoggedDb("lineup");
  const ids = (playerIds ?? []).filter(Boolean);
  if (!db || !managerId || !ids.length) return 0;

  const { data, error } = await db.rpc("ultima_clear_lineup_slots", {
    p_manager_id: managerId,
    p_player_ids: ids,
  });
  if (error) {
    console.error("[ultima/lineup] clear slots failed", error.message);
    return 0;
  }
  return data ?? 0;
}

export function squadLeagueCounts(roster) {
  const counts = { pl: 0, laliga: 0, seriea: 0, bundesliga: 0, ligue1: 0 };
  for (const p of roster) {
    if (p.league in counts) counts[p.league] += 1;
  }
  return counts;
}

export { ULTIMA_SQUAD_SIZE };

/**
 * Remove a country's captain, including one carried over from last week.
 * Needs the captain_off column. Returns { ok, code? }.
 */
export async function removeCaptain({ managerId, gameweekId, gameweek, playerId }) {
  const db = getLoggedDb("lineup");
  if (!db) return { ok: false, code: "CAPTAIN_UNAVAILABLE" };
  if (!gameweek) return { ok: false, code: "NO_GAMEWEEK" };

  const { states } = await getGameweekLeagueStates(gameweek.competition_id, gameweekId);
  let targetGwId = gameweekId;
  let lineup = await getLineup(managerId, gameweekId);
  let row = lineup.find((r) => r.player_id && r.player_id === playerId);
  const leagueState = row ? states[row.slot_group] : MATCHDAY_UPCOMING;

  if (xvSlotLocked(leagueState)) return { ok: false, code: "CAPTAIN_LOCKED" };

  if (leagueState === MATCHDAY_DONE) {
    const nextGw = await getNextGameweek(gameweek.competition_id, gameweek.number);
    if (!nextGw) return { ok: false, code: "CAPTAIN_LOCKED" };
    lineup = await seedNextLineupFromCurrent(db, managerId, gameweekId, nextGw.id);
    row = lineup.find((r) => r.player_id && r.player_id === playerId);
    targetGwId = nextGw.id;
  }

  if (!row) return { ok: false, code: "NOT_IN_XV" };

  const { error } = await db
    .from("ultima_lineups")
    .update({ is_captain: false, captain_off: true })
    .eq("manager_id", managerId)
    .eq("gameweek_id", targetGwId)
    .eq("slot", row.slot);
  if (error) {
    console.error("[ultima/lineup] remove captain failed", error.message);
    return { ok: false, code: "CAPTAIN_UNAVAILABLE" };
  }
  await recordUltimaEvent({
    event: "captain_removed",
    managerId,
    payload: { gameweek_id: targetGwId, player_id: playerId, league: row.slot_group },
  });
  return { ok: true, gameweekId: targetGwId };
}
