import { ULTIMA_LEAGUES } from "@/lib/ultima/constants";
import { isFinishedStatus, isLiveStatus, normalizeFixtureStatus } from "@/lib/ultima/fixture-status";
import { getCurrentGameweek } from "@/lib/ultima/server/bootstrap";
import { getActiveCompetition } from "@/lib/ultima/server/db";
import { recomputeGameweekScores } from "@/lib/ultima/server/scoring-run";
import {
  advanceGameweekState,
  loadPlayerLookupMaps,
  syncFixturesForGameweek,
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

function needsBackfillSync(fixture, statsCountByFixture) {
  if (!ULTIMA_LEAGUES.includes(fixture?.league)) return false;
  const status = normalizeFixtureStatus(fixture.status);
  if (isLiveStatus(status) || isFinishedStatus(status)) return true;
  // Include any stored fixture with no stat rows yet (covers mapping-only gaps).
  return (statsCountByFixture.get(fixture.id) ?? 0) === 0;
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

async function statsCountsForFixtures(db, fixtureIds) {
  const counts = new Map();
  if (!fixtureIds.length) return counts;
  const { data } = await db
    .from("ultima_player_match_stats")
    .select("fixture_id")
    .in("fixture_id", fixtureIds);
  for (const row of data ?? []) {
    counts.set(row.fixture_id, (counts.get(row.fixture_id) ?? 0) + 1);
  }
  return counts;
}

async function syncOneFixture(db, fixture, maps) {
  const status = normalizeFixtureStatus(fixture.status);
  if (!isFinishedStatus(status) && !isLiveStatus(status)) {
    return {
      fixtureId: fixture.id,
      league: fixture.league,
      status: "skipped",
      reason: "not_started",
      written: 0,
      failed: 0,
      changed: false,
      unmatchedPlayers: [],
    };
  }

  const stats = await syncStatsForFixtures([fixture], { includeLive: true, maps });
  const written = stats.statRows ?? 0;
  const failed = stats.failed ?? 0;
  const providerRows = stats.providerRows ?? 0;
  const unmatchedPlayers = stats.unmatchedPlayers ?? [];

  if (stats.ok === false && written === 0 && providerRows === 0) {
    return {
      fixtureId: fixture.id,
      league: fixture.league,
      status: "failed",
      reason: stats.error || "stat_write_failed",
      written: 0,
      failed: Math.max(failed, 1),
      changed: false,
      unmatchedPlayers,
    };
  }

  let reason = isLiveStatus(status) ? "live" : "awaiting_ratings";
  let outcome = "synced";
  // Stats without ratings still count as a change so they are not silently skipped.
  let changed = written > 0;

  if (isFinishedStatus(status) && stats.ratingsAvailable) {
    const { error: markError } = await db
      .from("ultima_fixtures")
      .update({ stats_final: true, updated_at: new Date().toISOString() })
      .eq("id", fixture.id);
    if (markError) {
      return {
        fixtureId: fixture.id,
        league: fixture.league,
        status: "failed",
        reason: markError.message,
        written,
        failed: failed + 1,
        changed: false,
        unmatchedPlayers,
      };
    }
    reason = "ratings_final";
    changed = true;
  } else if (written > 0 && isFinishedStatus(status) && !stats.ratingsAvailable) {
    // Keep polling later; do not mark stats_final.
    outcome = "synced";
    reason = "awaiting_ratings";
    changed = true;
  } else if (written === 0 && providerRows === 0 && isFinishedStatus(status)) {
    outcome = "skipped";
    reason = "no_stat_rows";
  } else if (written === 0 && failed > 0) {
    outcome = "failed";
    reason = "mapping_failed";
  } else if (written === 0 && unmatchedPlayers.length) {
    outcome = "failed";
    reason = "unmatched_players";
  }

  return {
    fixtureId: fixture.id,
    league: fixture.league,
    status: outcome,
    reason,
    written,
    failed,
    changed,
    unmatchedPlayers,
  };
}

/**
 * Sync live and unfinished FT fixtures for the current (or given) gameweek.
 * Cron: 4h kickoff window, skip stats_final. Backfill (commissioner): every
 * fixture in the gameweek after importing any missing Sportmonks rows.
 */
export async function runUltimaAutoSync({
  gameweekId = null,
  cursor = 0,
  batchSize = AUTO_SYNC_BATCH_SIZE,
  force = false,
  backfill = false,
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
      unmatchedPlayers: [],
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
      unmatchedPlayers: [],
      moreRemaining: false,
      nextCursor: 0,
      elapsedMs,
    };
  }

  let fixturesImported = 0;
  let missingImported = 0;
  // cursor < 0: first backfill chunk (import missing fixtures). cursor >= 0: stats only.
  const cursorNum = Number.isFinite(Number(cursor)) ? Number(cursor) : -1;
  if (backfill && cursorNum < 0) {
    const before = await db
      .from("ultima_fixtures")
      .select("sportmonks_fixture_id")
      .eq("gameweek_id", gameweek.id)
      .in("league", ULTIMA_LEAGUES);
    const beforeIds = new Set((before.data ?? []).map((row) => row.sportmonks_fixture_id).filter(Boolean));

    const imported = await syncFixturesForGameweek(gameweek);
    fixturesImported = imported.synced ?? 0;

    const after = await db
      .from("ultima_fixtures")
      .select("sportmonks_fixture_id")
      .eq("gameweek_id", gameweek.id)
      .in("league", ULTIMA_LEAGUES);
    const afterIds = new Set((after.data ?? []).map((row) => row.sportmonks_fixture_id).filter(Boolean));
    for (const id of afterIds) {
      if (!beforeIds.has(id)) missingImported += 1;
    }

    console.info("[ultima/auto-sync]", {
      phase: "fixture_import",
      gameweekId: gameweek.id,
      synced: fixturesImported,
      newlyStored: missingImported,
      ok: imported.ok !== false,
      error: imported.error ?? null,
    });

    if (budgetLeft() <= 800) {
      const elapsedMs = Date.now() - started;
      return {
        ok: imported.ok !== false,
        noop: false,
        phase: "fixture_import",
        gameweekId: gameweek.id,
        gameweek: gameweek.number,
        state: gameweek.state,
        fixturesImported,
        missingImported,
        candidates: 0,
        batch: 0,
        written: 0,
        failed: 0,
        managers: 0,
        fixtures: [],
        unmatchedPlayers: [],
        ligue1Unmatched: [],
        moreRemaining: true,
        nextCursor: 0,
        elapsedMs,
      };
    }
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

  // Cron only: 4h lookback. Backfill and force ignore the kickoff window.
  if (!force && !backfill) {
    query = query.gte("kickoff_at", lookbackIso).lte("kickoff_at", nowIso);
  }

  const { data: rows, error } = await query;
  if (error) {
    return { ok: false, error: error.message, elapsedMs: Date.now() - started };
  }

  const allRows = rows ?? [];
  const statsCounts = backfill
    ? await statsCountsForFixtures(db, allRows.map((row) => row.id))
    : new Map();

  const candidates = allRows.filter((row) => (
    backfill ? needsBackfillSync(row, statsCounts) : needsAutoSync(row, { force })
  ));

  if (!candidates.length) {
    const elapsedMs = Date.now() - started;
    console.info("[ultima/auto-sync]", {
      noop: true,
      reason: "nothing_to_sync",
      gameweekId: gameweek.id,
      fixturesImported,
      missingImported,
      elapsedMs,
    });
    return {
      ok: true,
      noop: true,
      reason: "nothing_to_sync",
      gameweekId: gameweek.id,
      gameweek: gameweek.number,
      fixturesImported,
      missingImported,
      fixtures: [],
      unmatchedPlayers: [],
      moreRemaining: false,
      nextCursor: 0,
      elapsedMs,
    };
  }

  const start = (force || backfill) ? Math.max(0, cursorNum < 0 ? 0 : cursorNum) : 0;
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
      fixturesImported,
      missingImported,
      candidates: candidates.length,
      batch: 0,
      written: 0,
      failed: 0,
      managers: 0,
      fixtures: [],
      unmatchedPlayers: [],
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
      fixturesImported,
      missingImported,
      candidates: candidates.length,
      batch: 0,
      written: 0,
      failed: 0,
      managers: 0,
      fixtures: [],
      unmatchedPlayers: [],
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
          unmatchedPlayers: [],
        };
      }
    }),
  );

  const fixtures = [];
  let written = 0;
  let failed = 0;
  const changedFixtureIds = [];
  const unmatchedPlayers = [];

  for (const result of settled) {
    written += result.written ?? 0;
    failed += result.failed ?? 0;
    if (result.changed) changedFixtureIds.push(result.fixtureId);
    for (const gap of result.unmatchedPlayers ?? []) unmatchedPlayers.push(gap);
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

  const moreRemaining = start + batch.length < candidates.length;
  const nextCursor = moreRemaining ? start + batch.length : 0;

  let state = gameweek.state;
  let managers = 0;
  if (rescore && changedFixtureIds.length) {
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
  const ligue1Unmatched = unmatchedPlayers.filter((row) => row.league === "ligue1");
  console.info("[ultima/auto-sync]", {
    gameweekId: gameweek.id,
    backfill,
    batch: batch.length,
    written,
    failed,
    managers,
    unmatched: unmatchedPlayers.length,
    ligue1Unmatched: ligue1Unmatched.length,
    moreRemaining,
    elapsedMs,
  });

  return {
    ok: failed === 0,
    noop: false,
    gameweekId: gameweek.id,
    gameweek: gameweek.number,
    state,
    fixturesImported,
    missingImported,
    candidates: candidates.length,
    batch: batch.length,
    written,
    failed,
    managers,
    fixtures,
    unmatchedPlayers,
    ligue1Unmatched,
    moreRemaining,
    nextCursor,
    elapsedMs,
  };
}
