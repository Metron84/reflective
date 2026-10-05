import {
  ULTIMA_BOLT_MIN_ROUND,
  ULTIMA_LEAGUES,
  ULTIMA_MIN_POOL_PER_LEAGUE,
  ULTIMA_MIN_POOL_TOTAL,
  leagueLabel,
} from "@/lib/ultima/constants";
import { diffPool } from "@/lib/ultima/pool-diff";
import {
  getProviderDiagnostics,
  getProviderName,
  getProviderStatsCoverage,
  getStatsProvider,
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
const UNDRAFTED_TTL_MS = 8_000;
const undraftedCache = new Map();

function invalidatePoolCache() {
  poolCache = { rows: null, at: 0 };
  undraftedCache.clear();
}

export function clearUndraftedCache(competitionId) {
  if (competitionId) undraftedCache.delete(competitionId);
  else undraftedCache.clear();
}

async function fetchAllActivePlayers(db, { strict = false } = {}) {
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

    if (error) {
      if (!strict) return rows;
      console.error("[ultima/read] ultima_players", error.message);
      throw new Error(`Could not read the player pool: ${error.message}`);
    }
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
 * The pool is frozen while the season draft is live or paused. A sync mid-draft
 * could change who is available under managers' feet.
 */
export async function seasonDraftInProgress(db) {
  const { data } = await db
    .from("ultima_draft_state")
    .select("state, ultima_competition!inner(kind)")
    .in("state", ["live", "paused"])
    .eq("ultima_competition.kind", "season");
  return (data ?? []).length > 0;
}

async function storedLeagueRows(db, league) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await db
      .from("ultima_players")
      .select("id, provider_id, name, club, active")
      .eq("league", league)
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error || !data?.length) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

function playerRow(p) {
  return {
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
  };
}

/**
 * Sync player pool from the active provider into ultima_players.
 * Returns a per-league report so a silent partial sync is visible.
 *
 * `league` syncs one league, so a request stays short. `dryRun` reads the
 * provider and reports what would change, and writes nothing. With a league the
 * report also carries a diff: added, club changes, and players gone inactive.
 */
export async function syncPlayerPool({ league = null, dryRun = false } = {}) {
  const db = getUltimaDb();
  if (!db) return { ok: false, error: "no_db" };

  if (await seasonDraftInProgress(db)) {
    return {
      ok: false,
      error: "draft_in_progress",
      message: "The draft is in progress. Player sync is frozen.",
    };
  }

  const provider = getProviderName();
  let players;
  if (league) {
    const live = getStatsProvider();
    players =
      typeof live.fetchPlayers === "function"
        ? await live.fetchPlayers(league)
        : (await syncAllPlayersFromProvider()).filter((p) => p.league === league);
  } else {
    players = await syncAllPlayersFromProvider();
  }
  const reasons = getProviderDiagnostics();
  const coverage = getProviderStatsCoverage();

  if (!players.length) {
    return {
      ok: false,
      error: "empty_pool",
      provider,
      league,
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

  const rows = [...deduped.values()].map(playerRow);
  const byLeague = countByLeagueFrom(rows);

  let diff = null;
  if (league) {
    const stored = await storedLeagueRows(db, league);
    const { data: season } = await db
      .from("ultima_competition")
      .select("id")
      .eq("is_active", true)
      .eq("kind", "season")
      .maybeSingle();
    const { count: pickCount } = season
      ? await db
          .from("ultima_draft_picks")
          .select("id", { count: "exact", head: true })
          .eq("competition_id", season.id)
      : { count: 0 };
    diff = diffPool({
      existing: stored,
      fresh: rows,
      canDeactivateMissing: (pickCount ?? 0) === 0,
    });
    diff.storedIds = new Map(stored.map((r) => [r.provider_id, r.id]));
  }

  if (!dryRun) {
    for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
      const { error } = await db
        .from("ultima_players")
        .upsert(rows.slice(i, i + UPSERT_CHUNK), { onConflict: "provider_id,league" });

      if (error) return { ok: false, error: error.message, provider, league, byLeague, reasons, coverage };
    }

    if (diff?.missingDeactivate.length) {
      for (let i = 0; i < diff.missingDeactivate.length; i += UPSERT_CHUNK) {
        const chunk = diff.missingDeactivate.slice(i, i + UPSERT_CHUNK);
        const { error } = await db
          .from("ultima_players")
          .update({ active: false })
          .eq("league", league)
          .in("provider_id", chunk);
        if (error) return { ok: false, error: error.message, provider, league, byLeague, reasons, coverage };
      }
    }

    // A queued player who is no longer in the pool is dropped from every queue.
    if (diff) {
      const gone = [
        ...diff.missingDeactivate,
        ...players.filter((p) => p.active === false).map((p) => p.provider_id),
      ]
        .map((pid) => diff.storedIds.get(pid))
        .filter(Boolean);
      for (let i = 0; i < gone.length; i += UPSERT_CHUNK) {
        await db.from("ultima_draft_queues").delete().in("player_id", gone.slice(i, i + UPSERT_CHUNK));
      }
    }

    invalidatePoolCache();
  }

  if (diff) {
    delete diff.storedIds;
    delete diff.missingDeactivate;
  }

  return { ok: true, count: rows.length, provider, league, dryRun, byLeague, reasons, coverage, diff };
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
  return fetchAllActivePlayers(db, { strict: true });
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

export async function getUndraftedPlayers(competitionId, { fresh = false } = {}) {
  const db = getUltimaDb();
  if (!db) return [];

  const hit = undraftedCache.get(competitionId);
  if (!fresh && hit && Date.now() - hit.at < UNDRAFTED_TTL_MS) return hit.rows;

  const pickedIds = await getDraftedPlayerIds(competitionId);
  const players = await fetchAllActivePlayers(db);
  const rows = players.filter((p) => !pickedIds.has(p.id));
  undraftedCache.set(competitionId, { at: Date.now(), rows });
  return rows;
}

export async function getFreeAgents(competitionId) {
  const db = getUltimaDb();
  if (!db) return [];

  const { data: rostered, error } = await db
    .from("ultima_rosters")
    .select("player_id, manager_id")
    .eq("competition_id", competitionId);
  if (error) {
    console.error("[ultima/read] ultima_rosters", error.message);
    throw new Error(`Could not read rosters: ${error.message}`);
  }

  const rosteredIds = new Set((rostered ?? []).map((r) => r.player_id));
  const players = await fetchAllActivePlayers(db, { strict: true });

  return players.filter((p) => !rosteredIds.has(p.id));
}

export function markBoltEligible(draftRound) {
  return typeof draftRound === "number" && draftRound >= ULTIMA_BOLT_MIN_ROUND;
}
