import { ULTIMA_LEAGUES } from "@/lib/ultima/constants";
import { isFinishedStatus, isLiveStatus, normalizeFixtureStatus } from "@/lib/ultima/fixture-status";
import { getCurrentGameweek } from "@/lib/ultima/server/bootstrap";
import { getActiveCompetition } from "@/lib/ultima/server/db";
import { recomputeGameweekScores } from "@/lib/ultima/server/scoring-run";
import {
  advanceGameweekState,
  importMissingFixturesForGameweek,
  loadPlayerLookupMaps,
  syncStatsForFixtures,
} from "@/lib/ultima/server/sync";
import { getLoggedDb } from "@/lib/ultima/server/strict-db";

/** Small enough for Vercel Hobby's 10s wall clock with Sportmonks latency. */
export const AUTO_SYNC_BATCH_SIZE = 3;
/** Whole cron call stays under this; leave headroom before Hobby's 10s kill. */
export const AUTO_SYNC_BUDGET_MS = 7_000;
/** Missing-fixture import gets its own shorter budget inside the call. */
export const AUTO_IMPORT_BUDGET_MS = 4_000;
/** Cron only imports missing fixtures this often, unless a prior import is unfinished. */
export const AUTO_IMPORT_INTERVAL_MS = 60 * 60 * 1000;
/** ultima_europe_sync row that tracks the hourly fixture-import stamp. */
export const AUTO_IMPORT_ROW_ID = "auto-fixture-import";
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

function isFresh(lastOkAt, now, ttlMs) {
  if (!lastOkAt) return false;
  const t = new Date(lastOkAt).getTime();
  return Number.isFinite(t) && now - t < ttlMs;
}

function emptyImportResult(extra = {}) {
  return {
    ran: false,
    found: 0,
    inserted: 0,
    failed: 0,
    moreRemaining: false,
    ...extra,
  };
}

async function readImportRow(db) {
  const { data } = await db
    .from("ultima_europe_sync")
    .select("id, last_ok_at, last_stat_counts, last_error, updated_at")
    .eq("id", AUTO_IMPORT_ROW_ID)
    .maybeSingle();
  return data ?? null;
}

async function writeImportProgress(db, { lastOkAt = undefined, progress, error = null }) {
  const stamp = new Date().toISOString();
  const payload = {
    id: AUTO_IMPORT_ROW_ID,
    last_stat_counts: progress,
    last_error: error,
    updated_at: stamp,
  };
  if (lastOkAt !== undefined) payload.last_ok_at = lastOkAt;
  await db.from("ultima_europe_sync").upsert(payload, { onConflict: "id" });
}

/**
 * Claim a new hourly import cycle (compare-and-swap on last_ok_at).
 * Returns false when another instance already claimed this hour.
 */
async function claimHourlyImport(db, row, now) {
  const stamp = new Date(now).toISOString();
  if (!row) {
    const { error } = await db.from("ultima_europe_sync").insert({
      id: AUTO_IMPORT_ROW_ID,
      last_ok_at: stamp,
      last_stat_counts: {
        incomplete: true,
        nextLeagueIndex: 0,
        found: 0,
        inserted: 0,
        failed: 0,
      },
      updated_at: stamp,
    });
    return !error;
  }

  let update = db
    .from("ultima_europe_sync")
    .update({
      last_ok_at: stamp,
      last_stat_counts: {
        incomplete: true,
        nextLeagueIndex: 0,
        found: 0,
        inserted: 0,
        failed: 0,
      },
      last_error: null,
      updated_at: stamp,
    })
    .eq("id", AUTO_IMPORT_ROW_ID);
  update = row.last_ok_at ? update.eq("last_ok_at", row.last_ok_at) : update.is("last_ok_at", null);
  const { data, error } = await update.select("id");
  return !error && (data ?? []).length > 0;
}

/**
 * Cron-only: import missing Sportmonks fixtures for the current gameweek,
 * at most once per hour, continuing unfinished league chunks on the next call.
 */
async function runHourlyFixtureImport(db, gameweek, { started, budgetLeft }) {
  const now = Date.now();
  let row = await readImportRow(db);
  const progress = row?.last_stat_counts && typeof row.last_stat_counts === "object"
    ? row.last_stat_counts
    : {};
  const incomplete =
    Boolean(progress.incomplete) &&
    (!progress.gameweekId || progress.gameweekId === gameweek.id);
  const due = !isFresh(row?.last_ok_at, now, AUTO_IMPORT_INTERVAL_MS);

  if (!incomplete && !due) {
    return emptyImportResult({ skipped: true, reason: "not_due" });
  }

  let nextLeagueIndex = Number(progress.nextLeagueIndex) || 0;
  let found = Number(progress.found) || 0;
  let inserted = Number(progress.inserted) || 0;
  let failed = Number(progress.failed) || 0;

  if (!incomplete) {
    const claimed = await claimHourlyImport(db, row, now);
    if (!claimed) {
      return emptyImportResult({ skipped: true, reason: "claimed_elsewhere" });
    }
    nextLeagueIndex = 0;
    found = 0;
    inserted = 0;
    failed = 0;
    row = await readImportRow(db);
  } else if (progress.gameweekId && progress.gameweekId !== gameweek.id) {
    nextLeagueIndex = 0;
    found = 0;
    inserted = 0;
    failed = 0;
  }

  const importDeadline = Math.min(
    started + AUTO_IMPORT_BUDGET_MS,
    started + AUTO_SYNC_BUDGET_MS - 500,
  );

  try {
    while (nextLeagueIndex < ULTIMA_LEAGUES.length) {
      if (Date.now() >= importDeadline || budgetLeft() <= 800) {
        const state = {
          incomplete: true,
          nextLeagueIndex,
          gameweekId: gameweek.id,
          found,
          inserted,
          failed,
        };
        await writeImportProgress(db, { progress: state });
        console.info("[ultima/auto-sync]", {
          phase: "fixture_import",
          gameweekId: gameweek.id,
          found,
          inserted,
          failed,
          moreRemaining: true,
          nextLeagueIndex,
        });
        return {
          ran: true,
          found,
          inserted,
          failed,
          moreRemaining: true,
          nextLeagueIndex,
        };
      }

      const league = ULTIMA_LEAGUES[nextLeagueIndex];
      const one = await importMissingFixturesForGameweek(db, gameweek, { leagues: [league] });
      found += one.found ?? 0;
      inserted += one.inserted ?? 0;
      failed += one.failed ?? 0;
      nextLeagueIndex += 1;
    }

    await writeImportProgress(db, {
      progress: {
        incomplete: false,
        nextLeagueIndex: ULTIMA_LEAGUES.length,
        gameweekId: gameweek.id,
        found,
        inserted,
        failed,
      },
    });
    console.info("[ultima/auto-sync]", {
      phase: "fixture_import",
      gameweekId: gameweek.id,
      found,
      inserted,
      failed,
      moreRemaining: false,
    });
    return {
      ran: true,
      found,
      inserted,
      failed,
      moreRemaining: false,
      nextLeagueIndex: ULTIMA_LEAGUES.length,
    };
  } catch (err) {
    const message = err?.message ?? "fixture_import_failed";
    console.error("[ultima/auto-sync]", {
      phase: "fixture_import",
      error: message,
      found,
      inserted,
      failed,
      nextLeagueIndex,
    });
    await writeImportProgress(db, {
      progress: {
        incomplete: true,
        nextLeagueIndex,
        gameweekId: gameweek.id,
        found,
        inserted,
        failed,
      },
      error: message,
    }).catch(() => {});
    return {
      ran: true,
      found,
      inserted,
      failed: failed + 1,
      moreRemaining: true,
      nextLeagueIndex,
      error: message,
    };
  }
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

async function importDueOrIncomplete(db, gameweekId, now) {
  const row = await readImportRow(db);
  const progress = row?.last_stat_counts && typeof row.last_stat_counts === "object"
    ? row.last_stat_counts
    : {};
  const incomplete =
    Boolean(progress.incomplete) &&
    (!progress.gameweekId || progress.gameweekId === gameweekId);
  if (incomplete) return { due: true, incomplete: true, row };
  if (!isFresh(row?.last_ok_at, now, AUTO_IMPORT_INTERVAL_MS)) {
    return { due: true, incomplete: false, row };
  }
  return { due: false, incomplete: false, row };
}

/**
 * Sync live and unfinished FT fixtures for the current (or given) gameweek.
 * Cron: hourly missing-fixture import + 4h kickoff window, skip stats_final.
 * Backfill (commissioner): every fixture in the gameweek after importing gaps.
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
      import: emptyImportResult({ skipped: true, reason: "no_competition" }),
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
      import: emptyImportResult({ skipped: true, reason: "no_gameweek" }),
      moreRemaining: false,
      nextCursor: 0,
      elapsedMs,
    };
  }

  let fixturesImported = 0;
  let missingImported = 0;
  let importResult = emptyImportResult();
  // cursor < 0: first backfill chunk (import missing fixtures). cursor >= 0: stats only.
  const cursorNum = Number.isFinite(Number(cursor)) ? Number(cursor) : -1;
  if (backfill && cursorNum < 0) {
    try {
      const imported = await importMissingFixturesForGameweek(db, gameweek);
      fixturesImported = imported.found ?? imported.synced ?? 0;
      missingImported = imported.inserted ?? 0;
      importResult = {
        ran: true,
        found: imported.found ?? 0,
        inserted: imported.inserted ?? 0,
        failed: imported.failed ?? 0,
        moreRemaining: false,
      };
      console.info("[ultima/auto-sync]", {
        phase: "fixture_import",
        backfill: true,
        gameweekId: gameweek.id,
        found: importResult.found,
        inserted: importResult.inserted,
        failed: importResult.failed,
        ok: imported.ok !== false,
        error: imported.error ?? null,
      });
    } catch (err) {
      importResult = {
        ran: true,
        found: 0,
        inserted: 0,
        failed: 1,
        moreRemaining: false,
        error: err?.message ?? "fixture_import_failed",
      };
      console.error("[ultima/auto-sync]", {
        phase: "fixture_import",
        backfill: true,
        error: importResult.error,
      });
    }

    if (budgetLeft() <= 800) {
      const elapsedMs = Date.now() - started;
      return {
        ok: importResult.failed === 0,
        noop: false,
        phase: "fixture_import",
        gameweekId: gameweek.id,
        gameweek: gameweek.number,
        state: gameweek.state,
        fixturesImported,
        missingImported,
        import: importResult,
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
  } else if (!force && !backfill) {
    // Cron path: cheap gate so idle 5-minute calls stay instant.
    const now = Date.now();
    const importGate = await importDueOrIncomplete(db, gameweek.id, now);
    const lookbackIso = new Date(now - AUTO_SYNC_KICKOFF_LOOKBACK_MS).toISOString();
    const nowIso = new Date(now).toISOString();
    const { data: peekRows } = await db
      .from("ultima_fixtures")
      .select("id, league, status, stats_final, kickoff_at")
      .eq("gameweek_id", gameweek.id)
      .in("league", ULTIMA_LEAGUES)
      .gte("kickoff_at", lookbackIso)
      .lte("kickoff_at", nowIso);
    const peekCandidates = (peekRows ?? []).filter((row) => needsAutoSync(row, { force: false }));

    if (!importGate.due && !peekCandidates.length) {
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
        fixturesImported: 0,
        missingImported: 0,
        import: emptyImportResult({ skipped: true, reason: "not_due" }),
        fixtures: [],
        unmatchedPlayers: [],
        moreRemaining: false,
        nextCursor: 0,
        elapsedMs,
      };
    }

    if (importGate.due) {
      importResult = await runHourlyFixtureImport(db, gameweek, { started, budgetLeft });
      fixturesImported = importResult.found ?? 0;
      missingImported = importResult.inserted ?? 0;
    } else {
      importResult = emptyImportResult({ skipped: true, reason: "not_due" });
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
    return {
      ok: false,
      error: error.message,
      import: importResult,
      elapsedMs: Date.now() - started,
    };
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
    const importMore = Boolean(importResult.moreRemaining);
    console.info("[ultima/auto-sync]", {
      noop: !importResult.ran,
      reason: importMore ? "import_more_remaining" : "nothing_to_sync",
      gameweekId: gameweek.id,
      fixturesImported,
      missingImported,
      import: importResult,
      elapsedMs,
    });
    return {
      ok: (importResult.failed ?? 0) === 0,
      noop: !importResult.ran && !importMore,
      reason: importMore ? "import_more_remaining" : "nothing_to_sync",
      gameweekId: gameweek.id,
      gameweek: gameweek.number,
      fixturesImported,
      missingImported,
      import: importResult,
      fixtures: [],
      unmatchedPlayers: [],
      moreRemaining: importMore,
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
      import: importResult,
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
      import: importResult,
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

  const statsMore = start + batch.length < candidates.length;
  const moreRemaining = statsMore || Boolean(importResult.moreRemaining);
  const nextCursor = statsMore ? start + batch.length : 0;

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
    import: {
      found: importResult.found,
      inserted: importResult.inserted,
      failed: importResult.failed,
      moreRemaining: importResult.moreRemaining,
    },
    moreRemaining,
    elapsedMs,
  });

  return {
    ok: failed === 0 && (importResult.failed ?? 0) === 0,
    noop: false,
    gameweekId: gameweek.id,
    gameweek: gameweek.number,
    state,
    fixturesImported,
    missingImported,
    import: importResult,
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
