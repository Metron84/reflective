import { ULTIMA_LEAGUES } from "@/lib/ultima/constants";
import { isFinishedStatus, isLiveStatus, normalizeFixtureStatus } from "@/lib/ultima/fixture-status";
import { getCurrentGameweek } from "@/lib/ultima/server/bootstrap";
import { getActiveCompetition } from "@/lib/ultima/server/db";
import { recomputeGameweekScores } from "@/lib/ultima/server/scoring-run";
import { advanceGameweekState, syncStatsForFixtures } from "@/lib/ultima/server/sync";
import { getLoggedDb } from "@/lib/ultima/server/strict-db";

/** Small enough for Vercel Hobby's 10s wall clock with Sportmonks latency. */
export const AUTO_SYNC_BATCH_SIZE = 3;

function needsAutoSync(fixture, { force = false } = {}) {
  if (!ULTIMA_LEAGUES.includes(fixture?.league)) return false;
  if (!force && fixture.stats_final) return false;
  const status = normalizeFixtureStatus(fixture.status);
  if (isLiveStatus(status)) return true;
  return isFinishedStatus(status);
}

/**
 * Sync live and unfinished FT fixtures for the current (or given) gameweek.
 * One Sportmonks pull per fixture, upserted by fixture+player. Marks stats_final
 * when ratings arrive on a finished match. Batched for the Hobby 10s limit.
 */
export async function runUltimaAutoSync({
  gameweekId = null,
  cursor = 0,
  batchSize = AUTO_SYNC_BATCH_SIZE,
  force = false,
  rescore = true,
} = {}) {
  const started = Date.now();
  const db = getLoggedDb("ultima/auto-sync");
  if (!db) return { ok: false, error: "no_db", elapsedMs: Date.now() - started };

  const competition = await getActiveCompetition();
  if (!competition) {
    return {
      ok: true,
      noop: true,
      reason: "no_competition",
      fixtures: [],
      moreRemaining: false,
      nextCursor: 0,
      elapsedMs: Date.now() - started,
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
    return {
      ok: true,
      noop: true,
      reason: "no_gameweek",
      fixtures: [],
      moreRemaining: false,
      nextCursor: 0,
      elapsedMs: Date.now() - started,
    };
  }

  const { data: rows, error } = await db
    .from("ultima_fixtures")
    .select("*")
    .eq("gameweek_id", gameweek.id)
    .in("league", ULTIMA_LEAGUES)
    .order("kickoff_at", { ascending: true });

  if (error) {
    return { ok: false, error: error.message, elapsedMs: Date.now() - started };
  }

  const candidates = (rows ?? []).filter((row) => needsAutoSync(row, { force }));
  if (!candidates.length) {
    return {
      ok: true,
      noop: true,
      reason: "nothing_to_sync",
      gameweekId: gameweek.id,
      gameweek: gameweek.number,
      fixtures: [],
      moreRemaining: false,
      nextCursor: 0,
      elapsedMs: Date.now() - started,
    };
  }

  const start = Math.max(0, Number(cursor) || 0);
  const size = Math.max(1, Math.min(Number(batchSize) || AUTO_SYNC_BATCH_SIZE, 8));
  const batch = candidates.slice(start, start + size);
  const moreRemaining = start + size < candidates.length;
  const nextCursor = moreRemaining ? start + size : 0;

  const fixtures = [];
  let written = 0;
  let failed = 0;

  for (const fixture of batch) {
    try {
      const status = normalizeFixtureStatus(fixture.status);
      const stats = await syncStatsForFixtures([fixture], { includeLive: true });
      written += stats.statRows ?? 0;
      failed += stats.failed ?? 0;

      if (stats.ok === false && (stats.statRows ?? 0) === 0) {
        const result = {
          fixtureId: fixture.id,
          league: fixture.league,
          status: "failed",
          reason: stats.error || "stat_write_failed",
          written: 0,
        };
        console.error("[ultima/auto-sync]", result);
        fixtures.push(result);
        continue;
      }

      let reason = isLiveStatus(status) ? "live" : "awaiting_ratings";
      let outcome = "synced";

      if (isFinishedStatus(status) && stats.ratingsAvailable) {
        const { error: markError } = await db
          .from("ultima_fixtures")
          .update({ stats_final: true, updated_at: new Date().toISOString() })
          .eq("id", fixture.id);
        if (markError) {
          outcome = "failed";
          reason = markError.message;
          failed += 1;
        } else {
          reason = "ratings_final";
        }
      } else if ((stats.statRows ?? 0) === 0 && isFinishedStatus(status)) {
        outcome = "skipped";
        reason = "awaiting_ratings";
      }

      const result = {
        fixtureId: fixture.id,
        league: fixture.league,
        status: outcome,
        reason,
        written: stats.statRows ?? 0,
      };
      if (outcome === "failed") console.error("[ultima/auto-sync]", result);
      else console.info("[ultima/auto-sync]", result);
      fixtures.push(result);
    } catch (err) {
      failed += 1;
      const result = {
        fixtureId: fixture.id,
        league: fixture.league,
        status: "failed",
        reason: err?.message ?? "fixture_failed",
        written: 0,
      };
      console.error("[ultima/auto-sync]", result);
      fixtures.push(result);
    }
  }

  let state = gameweek.state;
  let managers = 0;
  if (rescore) {
    const advanced = await advanceGameweekState(gameweek);
    state = advanced.state ?? gameweek.state;
    const scores = await recomputeGameweekScores(competition.id, gameweek.id);
    managers = scores?.managers ?? 0;
  }

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
    elapsedMs: Date.now() - started,
  };
}
