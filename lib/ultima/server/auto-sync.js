import { ULTIMA_LEAGUES } from "@/lib/ultima/constants";
import { isFinishedStatus, isLiveStatus, normalizeFixtureStatus } from "@/lib/ultima/fixture-status";
import { getCurrentGameweek } from "@/lib/ultima/server/bootstrap";
import { getActiveCompetition } from "@/lib/ultima/server/db";
import { recomputeGameweekScores } from "@/lib/ultima/server/scoring-run";
import {
  advanceGameweekState,
  loadPlayerLookupMaps,
  syncStatsForFixtures,
} from "@/lib/ultima/server/sync";
import { getLoggedDb } from "@/lib/ultima/server/strict-db";

/** Small enough for Vercel Hobby's 10s wall clock with Sportmonks latency. */
export const AUTO_SYNC_BATCH_SIZE = 3;
/** Stop work before Hobby's hard 10s kill. */
export const AUTO_SYNC_BUDGET_MS = 6_000;
/** Only fixtures that kicked off inside this window are eligible for cron sync. */
export const AUTO_SYNC_KICKOFF_LOOKBACK_MS = 4 * 60 * 60 * 1000;

function needsAutoSync(fixture, { force = false } = {}) {
  if (!ULTIMA_LEAGUES.includes(fixture?.league)) return false;
  if (!force && fixture.stats_final) return false;
  const status = normalizeFixtureStatus(fixture.status);
  if (isLiveStatus(status)) return true;
  return isFinishedStatus(status);
}

async function managersOwningFixturePlayers(db, gameweekId, fixtureIds) {
  if (!fixtureIds.length) return [];
  const { data: stats } = await db
    .from("ultima_player_match_stats")
    .select("player_id")
    .in("fixture_id", fixtureIds);
  const playerIds = [...new Set((stats ?? []).map((row) => row.player_id).filter(Boolean))];
  if (!playerIds.length) return [];
  const { data: lineups } = await db
    .from("ultima_lineups")
    .select("manager_id")
    .eq("gameweek_id", gameweekId)
    .in("player_id", playerIds);
  return [...new Set((lineups ?? []).map((row) => row.manager_id).filter(Boolean))];
}

async function syncOneFixture(db, fixture, maps) {
  const status = normalizeFixtureStatus(fixture.status);
  const stats = await syncStatsForFixtures([fixture], { includeLive: true, maps });
  const written = stats.statRows ?? 0;
  const failed = stats.failed ?? 0;

  if (stats.ok === false && written === 0) {
    return {
      fixtureId: fixture.id,
      league: fixture.league,
      status: "failed",
      reason: stats.error || "stat_write_failed",
      written: 0,
      failed,
      changed: false,
    };
  }

  let reason = isLiveStatus(status) ? "live" : "awaiting_ratings";
  let outcome = "synced";
  let changed = written > 0;

  if (isFinishedStatus(status) && stats.ratingsAvailable) {
    const { error: markError } = await db
      .from("ultima_fixtures")
      .update({ stats_final: true, updated_at: new Date().toISOString() })
      .eq("id", fixture.id);
    if (markError) {
      outcome = "failed";
      reason = markError.message;
      return {
        fixtureId: fixture.id,
        league: fixture.league,
        status: outcome,
        reason,
        written,
        failed: failed + 1,
        changed: false,
      };
    }
    reason = "ratings_final";
    changed = true;
  } else if (written === 0 && isFinishedStatus(status)) {
    outcome = "skipped";
    reason = "awaiting_ratings";
  }

  return {
    fixtureId: fixture.id,
    league: fixture.league,
    status: outcome,
    reason,
    written,
    failed,
    changed,
  };
}

/**
 * Sync live and unfinished FT fixtures for the current (or given) gameweek.
 * Cron calls always take the oldest eligible fixtures; a 6s budget stops the
 * batch before Hobby's 10s kill. Sportmonks pulls run in parallel per batch.
 */
export async function runUltimaAutoSync({
  gameweekId = null,
  cursor = 0,
  batchSize = AUTO_SYNC_BATCH_SIZE,
  force = false,
  rescore = true,
} = {}) {
  const started = Date.now();
  const budgetLeft = () => AUTO_SYNC_BUDGET_MS - (Date.now() - started);
  const db = getLoggedDb("ultima/auto-sync");
  if (!db) return { ok: false, error: "no_db", elapsedMs: Date.now() - started };

  const competition = await getActiveCompetition();
  if (!competition) {
    const elapsedMs = Date.now() - started;
    console.info("[ultima/auto-sync]", { noop: true, reason: "no_competition", elapsedMs });
    return {
      ok: true,
      noop: true,
      reason: "no_competition",
      fixtures: [],
      moreRemaining: false,
      nextCursor: 0,
      elapsedMs,
    };
  }

  let gameweek = null;
  if (gameweekId) {
    const { data } = await db
      .from("ultima_gameweeks")
      .select("*")
      .eq("id", gameweekId)
      .eq("competition_id", competition.id)
      .maybeSingle();
    gameweek = data;
  } else {
    gameweek = await getCurrentGameweek(competition.id);
  }

  if (!gameweek?.id) {
    const elapsedMs = Date.now() - started;
    console.info("[ultima/auto-sync]", { noop: true, reason: "no_gameweek", elapsedMs });
    return {
      ok: true,
      noop: true,
      reason: "no_gameweek",
      fixtures: [],
      moreRemaining: false,
      nextCursor: 0,
      elapsedMs,
    };
  }

  const now = Date.now();
  const lookbackIso = new Date(now - AUTO_SYNC_KICKOFF_LOOKBACK_MS).toISOString();
  const nowIso = new Date(now).toISOString();

  let query = db
    .from("ultima_fixtures")
    .select("*")
    .eq("gameweek_id", gameweek.id)
    .in("league", ULTIMA_LEAGUES)
    .order("kickoff_at", { ascending: true });

  // Cron: only fixtures that have kicked off in the last 4 hours. Never future.
  // Commissioner force keeps the wider gameweek set so Resync can catch stragglers.
  if (!force) {
    query = query.gte("kickoff_at", lookbackIso).lte("kickoff_at", nowIso);
  }

  const { data: rows, error } = await query;
  if (error) {
    return { ok: false, error: error.message, elapsedMs: Date.now() - started };
  }

  const candidates = (rows ?? []).filter((row) => needsAutoSync(row, { force }));
  if (!candidates.length) {
    const elapsedMs = Date.now() - started;
    console.info("[ultima/auto-sync]", {
      noop: true,
      reason: "nothing_to_sync",
      gameweekId: gameweek.id,
      elapsedMs,
    });
    return {
      ok: true,
      noop: true,
      reason: "nothing_to_sync",
      gameweekId: gameweek.id,
      gameweek: gameweek.number,
      fixtures: [],
      moreRemaining: false,
      nextCursor: 0,
      elapsedMs,
    };
  }

  // Always take the oldest unsynced fixtures. Cursor is ignored for cron pickup;
  // it remains in the response for callers that still pass one.
  const start = force ? Math.max(0, Number(cursor) || 0) : 0;
  const size = Math.max(1, Math.min(Number(batchSize) || AUTO_SYNC_BATCH_SIZE, 8));

  if (budgetLeft() <= 0) {
    const elapsedMs = Date.now() - started;
    console.info("[ultima/auto-sync]", { budget: "exhausted_before_batch", elapsedMs });
    return {
      ok: true,
      noop: false,
      gameweekId: gameweek.id,
      gameweek: gameweek.number,
      state: gameweek.state,
      candidates: candidates.length,
      batch: 0,
      written: 0,
      failed: 0,
      managers: 0,
      fixtures: [],
      moreRemaining: true,
      nextCursor: start,
      elapsedMs,
    };
  }

  const batch = candidates.slice(start, start + size);
  const maps = await loadPlayerLookupMaps(db);

  if (budgetLeft() <= 500) {
    const elapsedMs = Date.now() - started;
    console.info("[ultima/auto-sync]", { budget: "exhausted_after_maps", elapsedMs });
    return {
      ok: true,
      noop: false,
      gameweekId: gameweek.id,
      gameweek: gameweek.number,
      state: gameweek.state,
      candidates: candidates.length,
      batch: 0,
      written: 0,
      failed: 0,
      managers: 0,
      fixtures: [],
      moreRemaining: true,
      nextCursor: start,
      elapsedMs,
    };
  }

  const settled = await Promise.all(
    batch.map(async (fixture) => {
      try {
        return await syncOneFixture(db, fixture, maps);
      } catch (err) {
        return {
          fixtureId: fixture.id,
          league: fixture.league,
          status: "failed",
          reason: err?.message ?? "fixture_failed",
          written: 0,
          failed: 1,
          changed: false,
        };
      }
    }),
  );

  const fixtures = [];
  let written = 0;
  let failed = 0;
  const changedFixtureIds = [];

  for (const result of settled) {
    written += result.written ?? 0;
    failed += result.failed ?? 0;
    if (result.changed) changedFixtureIds.push(result.fixtureId);
    const line = {
      fixtureId: result.fixtureId,
      league: result.league,
      status: result.status,
      reason: result.reason,
      written: result.written ?? 0,
    };
    if (result.status === "failed") console.error("[ultima/auto-sync]", line);
    else console.info("[ultima/auto-sync]", line);
    fixtures.push(line);
  }

  const moreRemaining = start + batch.length < candidates.length || budgetLeft() <= 0;
  const nextCursor = moreRemaining ? start + batch.length : 0;

  let state = gameweek.state;
  let managers = 0;
  if (rescore && changedFixtureIds.length) {
    // Always rescore the squads that own the changed players. That is cheaper
    // than Sportmonks and must not be skipped after stats_final is set.
    const managerIds = await managersOwningFixturePlayers(db, gameweek.id, changedFixtureIds);
    if (managerIds.length) {
      const scores = await recomputeGameweekScores(competition.id, gameweek.id, { managerIds });
      managers = scores?.managers ?? 0;
    }
    if (budgetLeft() > 400) {
      const advanced = await advanceGameweekState(gameweek);
      state = advanced.state ?? gameweek.state;
    }
  }

  const elapsedMs = Date.now() - started;
  console.info("[ultima/auto-sync]", {
    gameweekId: gameweek.id,
    batch: batch.length,
    written,
    failed,
    managers,
    moreRemaining,
    elapsedMs,
  });

  return {
    ok: failed === 0,
    noop: false,
    gameweekId: gameweek.id,
    gameweek: gameweek.number,
    state,
    candidates: candidates.length,
    batch: batch.length,
    written,
    failed,
    managers,
    fixtures,
    moreRemaining,
    nextCursor,
    elapsedMs,
  };
}
