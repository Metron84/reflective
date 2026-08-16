import {
  ULTIMA_BOLT_MIN_ROUND,
  ULTIMA_LEAGUES,
  ULTIMA_MIN_POOL_PER_LEAGUE,
  ULTIMA_MIN_POOL_TOTAL,
  leagueLabel,
} from "@/lib/ultima/constants";
import {
  getProviderDiagnostics,
  getProviderName,
  getProviderStatsCoverage,
  syncAllPlayersFromProvider,
} from "@/lib/ultima/provider/index";
import { getUltimaDb } from "@/lib/ultima/server/db";

/** PostgREST caps a select at 1000 rows, and a five-league pool is larger. */
const PAGE_SIZE = 1000;

/** Keep a full-pool sync inside a sensible request body. */
const UPSERT_CHUNK = 500;

/**
 * Which players exist does not change during a draft, yet every pick was reading
 * the whole pool back twice. At three pages a read and a chain of bot picks in one
 * request, that was the bulk of the work. Cached briefly per server instance.
 */
const POOL_CACHE_TTL_MS = 60_000;
let poolCache = { rows: null, at: 0 };

function invalidatePoolCache() {
  poolCache = { rows: null, at: 0 };
}

async function fetchAllActivePlayers(db) {
  if (poolCache.rows && Date.now() - poolCache.at < POOL_CACHE_TTL_MS) {
    return poolCache.rows;
  }

  const rows = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await db
      .from("ultima_players")
      .select("*")
      .eq("active", true)
      .order("id")
      .range(from, from + PAGE_SIZE - 1);

    if (error) return rows;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }

  poolCache = { rows, at: Date.now() };
  return rows;
}

function countByLeagueFrom(players) {
  const counts = Object.fromEntries(ULTIMA_LEAGUES.map((l) => [l, 0]));
  for (const p of players) {
    if (p.league in counts) counts[p.league] += 1;
  }
  return counts;
}

/**
 * Sync player pool from the active provider into ultima_players.
 * Returns a per-league report so a silent partial sync is visible.
 */
export async function syncPlayerPool() {
  const db = getUltimaDb();
  if (!db) return { ok: false, error: "no_db" };

  const provider = getProviderName();
  const players = await syncAllPlayersFromProvider();
  const reasons = getProviderDiagnostics();
  const coverage = getProviderStatsCoverage();

  if (!players.length) {
    return {
      ok: false,
      error: "empty_pool",
      provider,
      byLeague: countByLeagueFrom([]),
      reasons,
      coverage,
      count: 0,
    };
  }

  // A player who moved mid-season can appear in two squads. Upserting both
  // hits the same conflict target twice and Postgres rejects the whole batch.
  const deduped = new Map();
  for (const p of players) {
    deduped.set(`${p.league}:${p.provider_id}`, p);
  }

  const rows = [...deduped.values()].map((p) => ({
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

  const byLeague = countByLeagueFrom(rows);

  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const { error } = await db
      .from("ultima_players")
      .upsert(rows.slice(i, i + UPSERT_CHUNK), { onConflict: "provider_id,league" });

    if (error) return { ok: false, error: error.message, provider, byLeague, reasons, coverage };
  }

  invalidatePoolCache();

  return { ok: true, count: rows.length, provider, byLeague, reasons, coverage };
}

/**
 * Is the stored pool large enough for ten squads of thirty with their floors?
 * Counted server side, since a full five-league pool exceeds the row cap.
 */
export async function checkPlayerPool() {
  const db = getUltimaDb();
  if (!db) return { ok: false, total: 0, byLeague: {}, short: [...ULTIMA_LEAGUES] };

  const byLeague = {};
  let total = 0;

  for (const league of ULTIMA_LEAGUES) {
    const { count } = await db
      .from("ultima_players")
      .select("id", { count: "exact", head: true })
      .eq("active", true)
      .eq("league", league);

    byLeague[league] = count ?? 0;
    total += count ?? 0;
  }

  const short = ULTIMA_LEAGUES.filter((l) => byLeague[l] < ULTIMA_MIN_POOL_PER_LEAGUE);

  return {
    ok: total >= ULTIMA_MIN_POOL_TOTAL && short.length === 0,
    total,
    byLeague,
    short,
  };
}

/** Plain line explaining why a pool cannot run a draft. */
export function describePoolShortfall(pool) {
  if (!pool || pool.total === 0) {
    return "No players in the pool yet. Sync players from the admin page first.";
  }

  if (pool.short?.length) {
    const names = pool.short.map((l) => leagueLabel(l)).join(", ");
    return `Not enough players to finish a draft. Short in ${names}. Sync players from the admin page.`;
  }

  return `Not enough players to finish a draft. The pool holds ${pool.total} of the ${ULTIMA_MIN_POOL_TOTAL} needed.`;
}

export async function getAllDbPlayers() {
  const db = getUltimaDb();
  if (!db) return [];
  return fetchAllActivePlayers(db);
}

export async function getDraftedPlayerIds(competitionId) {
  const db = getUltimaDb();
  if (!db || !competitionId) return new Set();

  const pickedIds = new Set();
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await db
      .from("ultima_draft_picks")
      .select("player_id")
      .eq("competition_id", competitionId)
      .order("pick_number")
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error("Ultima drafted-id read failed", {
        competition_id: competitionId,
        message: error.message,
      });
      throw new Error(`Could not read drafted players: ${error.message}`);
    }
    if (!data?.length) break;
    for (const row of data) {
      if (row.player_id) pickedIds.add(row.player_id);
    }
    if (data.length < PAGE_SIZE) break;
  }

  return pickedIds;
}

export async function getUndraftedPlayers(competitionId) {
  const db = getUltimaDb();
  if (!db) return [];

  const pickedIds = await getDraftedPlayerIds(competitionId);
  const players = await fetchAllActivePlayers(db);

  return players.filter((p) => !pickedIds.has(p.id));
}

export async function getFreeAgents(competitionId) {
  const db = getUltimaDb();
  if (!db) return [];

  const { data: rostered } = await db
    .from("ultima_rosters")
    .select("player_id, manager_id")
    .eq("competition_id", competitionId);

  const rosteredIds = new Set((rostered ?? []).map((r) => r.player_id));
  const players = await fetchAllActivePlayers(db);

  return players.filter((p) => !rosteredIds.has(p.id));
}

export function markBoltEligible(draftRound) {
  return typeof draftRound === "number" && draftRound >= ULTIMA_BOLT_MIN_ROUND;
}
