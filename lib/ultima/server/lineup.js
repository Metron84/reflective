import {
  emptyLineupTemplate,
  validateXiFloors,
  isXiComplete,
  canPlaceInSlot,
} from "@/lib/ultima/lineup/slots";
import { ULTIMA_SQUAD_SIZE } from "@/lib/ultima/constants";
import { publishUltimaEvent } from "@/lib/ultima/server/events";
import { getUltimaDb } from "@/lib/ultima/server/db";

export async function getManagerRoster(managerId) {
  const db = getUltimaDb();
  if (!db) return [];

  const { data } = await db
    .from("ultima_rosters")
    .select("player_id, ultima_players(*)")
    .eq("manager_id", managerId);

  return (data ?? []).map((r) => r.ultima_players).filter(Boolean);
}

export async function getLineup(managerId, gameweekId) {
  const db = getUltimaDb();
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
        }
      : t;
  });
}

/**
 * Check if a league is locked for this gameweek.
 */
export function isLeagueLocked(gameweek, league) {
  if (!gameweek?.league_open_at) return false;
  const openAt = gameweek.league_open_at[league];
  if (!openAt) return false;
  return Date.now() >= new Date(openAt).getTime();
}

export async function saveLineup({
  managerId,
  gameweekId,
  slots,
  gameweek,
}) {
  const db = getUltimaDb();
  if (!db) return { ok: false, code: "UNAVAILABLE" };

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

  // Validate all players are on roster
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

  // Check locked slots
  for (const row of lineup) {
    if (!row.player_id) continue;
    const player = playersById.get(row.player_id);
    if (player && isLeagueLocked(gameweek, player.league)) {
      const existing = await getLineup(managerId, gameweekId);
      const prev = existing.find((e) => e.slot === row.slot);
      if (prev?.player_id !== row.player_id) {
        return { ok: false, code: "LEAGUE_LOCKED" };
      }
    }
  }

  const floorCheck = validateXiFloors(lineup, playersById);
  if (!floorCheck.ok && isXiComplete(lineup)) {
    return { ok: false, code: "FLOOR_VIOLATION", message: floorCheck.reason };
  }

  // Upsert lineup rows
  for (const row of lineup) {
    const locked =
      row.player_id &&
      isLeagueLocked(gameweek, playersById.get(row.player_id)?.league);

    await db.from("ultima_lineups").upsert(
      {
        manager_id: managerId,
        gameweek_id: gameweekId,
        slot: row.slot,
        slot_group: row.slot_group,
        player_id: row.player_id,
        locked_at: locked ? new Date().toISOString() : null,
        auto_started: row.auto_started,
      },
      { onConflict: "manager_id,gameweek_id,slot" },
    );
  }

  await db.from("ultima_events").insert({
    event: "xi_saved",
    manager_id: managerId,
    payload: { gameweek_id: gameweekId },
  });

  publishUltimaEvent("lineup.lock", { manager_id: managerId, gameweek_id: gameweekId });

  return { ok: true };
}

export async function ensureLineupExists(managerId, gameweekId) {
  const db = getUltimaDb();
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

export function squadLeagueCounts(roster) {
  const counts = { pl: 0, laliga: 0, seriea: 0 };
  for (const p of roster) counts[p.league] += 1;
  return counts;
}

export { ULTIMA_SQUAD_SIZE };
