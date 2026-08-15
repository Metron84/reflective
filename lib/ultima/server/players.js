import { ULTIMA_BOLT_MIN_ROUND, ULTIMA_LEAGUES } from "@/lib/ultima/constants";
import { syncAllPlayersFromProvider } from "@/lib/ultima/provider/index";
import { getUltimaDb } from "@/lib/ultima/server/db";

/**
 * Sync player pool from the active provider into ultima_players.
 */
export async function syncPlayerPool() {
  const db = getUltimaDb();
  if (!db) return { ok: false, error: "no_db" };

  const players = await syncAllPlayersFromProvider();
  if (!players.length) return { ok: false, error: "empty_pool" };

  const rows = players.map((p) => ({
    provider_id: p.provider_id,
    name: p.name,
    league: p.league,
    club: p.club,
    active: p.active !== false,
    seed_metrics: {
      goals_rate: p.goals_rate ?? 0,
      assists_rate: p.assists_rate ?? 0,
      rating_avg: p.rating_avg ?? 0,
      rating_consistency: p.rating_consistency ?? 0,
      minutes_reliability: p.minutes_reliability ?? 0,
      club_strength: p.club_strength ?? 0,
      sportmonks_player_id: p.sportmonks_player_id ?? null,
    },
  }));

  const { error } = await db.from("ultima_players").upsert(rows, {
    onConflict: "provider_id,league",
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, count: rows.length };
}

export async function getAllDbPlayers() {
  const db = getUltimaDb();
  if (!db) return [];
  const { data } = await db.from("ultima_players").select("*").eq("active", true);
  return data ?? [];
}

export async function getUndraftedPlayers(competitionId) {
  const db = getUltimaDb();
  if (!db) return [];

  const { data: picked } = await db
    .from("ultima_draft_picks")
    .select("player_id")
    .eq("competition_id", competitionId);

  const pickedIds = new Set((picked ?? []).map((p) => p.player_id));

  const { data: players } = await db
    .from("ultima_players")
    .select("*")
    .eq("active", true);

  return (players ?? []).filter((p) => !pickedIds.has(p.id));
}

export async function getFreeAgents(competitionId) {
  const db = getUltimaDb();
  if (!db) return [];

  const { data: rostered } = await db
    .from("ultima_rosters")
    .select("player_id, manager_id");

  const rosteredIds = new Set((rostered ?? []).map((r) => r.player_id));

  const { data: players } = await db
    .from("ultima_players")
    .select("*")
    .eq("active", true);

  return (players ?? []).filter((p) => !rosteredIds.has(p.id));
}

export function markBoltEligible(draftRound) {
  return typeof draftRound === "number" && draftRound >= ULTIMA_BOLT_MIN_ROUND;
}
