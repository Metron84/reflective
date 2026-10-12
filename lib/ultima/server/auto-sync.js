import { ULTIMA_LEAGUES } from "@/lib/ultima/constants";
import {
  addPendingRescore,
  clearPendingRescore,
  nextScoreQueue,
  prepareAutoSyncBatch,
  settlePendingRescores,
  storedStatusForRemote,
} from "@/lib/ultima/auto-sync-select";
import { isAbandonedStatus, isFinishedStatus, isLiveStatus, normalizeFixtureStatus } from "@/lib/ultima/fixture-status";
import { getCurrentGameweek } from "@/lib/ultima/server/bootstrap";
import { getActiveCompetition } from "@/lib/ultima/server/db";
import { getStatsProvider } from "@/lib/ultima/provider/index";
import { recordUltimaEvent } from "@/lib/ultima/server/record-event";
import { linkNullStatPlayers, loadPlayerIndex } from "@/lib/ultima/server/link-stats";
import { autoStartUnsetLineups } from "@/lib/ultima/server/auto-start-lineups";
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

function progressFromRow(row) {
  return row?.last_stat_counts && typeof row.last_stat_counts === "object"
    ? row.last_stat_counts
    : {};
}

function pendingIdsFromProgress(progress) {
  return [...new Set((progress.pendingFixtureIds ?? []).filter(Boolean))];
}

async function writeImportProgress(db, { lastOkAt = undefined, progress, error } = {}) {
  const existing = progressFromRow(await readImportRow(db));
  const merged = {
    ...existing,
    ...progress,
    statsCursor: progress.statsCursor ?? existing.statsCursor ?? 0,
    pendingFixtureIds: progress.pendingFixtureIds ?? pendingIdsFromProgress(existing),
  };
  const stamp = new Date().toISOString();
  const payload = {
    id: AUTO_IMPORT_ROW_ID,
    last_stat_counts: merged,
    updated_at: stamp,
  };
  if (lastOkAt !== undefined) payload.last_ok_at = lastOkAt;
  if (error !== undefined) payload.last_error = error;
  const { error: writeError } = await db
    .from("ultima_europe_sync")
    .upsert(payload, { onConflict: "id" });
  if (writeError) {
    console.error("[ultima/auto-sync]", {
      phase: "fixture_import",
      error: writeError.message,
      progress,
    });
    return false;
  }
  return true;
}

/**
 * Claim a new hourly import cycle (compare-and-swap on last_ok_at).
 * Returns false when another instance already claimed this hour.
 * Keeps any pendingFixtureIds that still need stats on later calls.
 */
async function claimHourlyImport(db, row, now, pendingFixtureIds = []) {
  const stamp = new Date(now).toISOString();
  const baseProgress = {
    incomplete: true,
    nextLeagueIndex: 0,
    found: 0,
    inserted: 0,
    failed: 0,
    pendingFixtureIds,
    statsCursor: Number(progressFromRow(row).statsCursor) || 0,
  };
  if (!row) {
    const { error } = await db.from("ultima_europe_sync").insert({
      id: AUTO_IMPORT_ROW_ID,
      last_ok_at: stamp,
      last_stat_counts: baseProgress,
      updated_at: stamp,
    });
    return !error;
  }

  let update = db
    .from("ultima_europe_sync")
    .update({
      last_ok_at: stamp,
      last_stat_counts: baseProgress,
      last_error: null,
      updated_at: stamp,
    })
    .eq("id", AUTO_IMPORT_ROW_ID);
  update = row.last_ok_at ? update.eq("last_ok_at", row.last_ok_at) : update.is("last_ok_at", null);
  const { data, error } = await update.select("id");
  return !error && (data ?? []).length > 0;
}

/**
 * Cron-only: import at most one league per call. Position lives in Supabase
 * (ultima_europe_sync), so the cron never needs a cursor. Full pass once an
 * hour; unfinished leagues continue on the next 5-minute hit.
 */
async function runHourlyFixtureImport(db, gameweek, { started, budgetLeft }) {
  const now = Date.now();
  const row = await readImportRow(db);
  const progress = progressFromRow(row);
  const sameGameweek = !progress.gameweekId || progress.gameweekId === gameweek.id;
  const incomplete = Boolean(progress.incomplete) && sameGameweek;
  // A new gameweek does not wait out the hour. Catch-up moves oldest first.
  const due = !sameGameweek || !isFresh(row?.last_ok_at, now, AUTO_IMPORT_INTERVAL_MS);

  if (!incomplete && !due) {
    return emptyImportResult({
      skipped: true,
      reason: "not_due",
      pendingFixtureIds: pendingIdsFromProgress(progress),
    });
  }

  let nextLeagueIndex = Number(progress.nextLeagueIndex) || 0;
  let found = Number(progress.found) || 0;
  let inserted = Number(progress.inserted) || 0;
  let failed = Number(progress.failed) || 0;
  let pendingFixtureIds = pendingIdsFromProgress(progress);

  if (!incomplete) {
    const claimed = await claimHourlyImport(db, row, now, pendingFixtureIds);
    if (!claimed) {
      return emptyImportResult({ skipped: true, reason: "claimed_elsewhere" });
    }
    nextLeagueIndex = 0;
    found = 0;
    inserted = 0;
    failed = 0;
  } else if (progress.gameweekId && progress.gameweekId !== gameweek.id) {
    nextLeagueIndex = 0;
    found = 0;
    inserted = 0;
    failed = 0;
  }

  if (nextLeagueIndex >= ULTIMA_LEAGUES.length) {
    await writeImportProgress(db, {
      progress: {
        incomplete: false,
        nextLeagueIndex: 0,
        gameweekId: gameweek.id,
        found,
        inserted,
        failed,
        pendingFixtureIds,
      },
    });
    return {
      ran: false,
      found,
      inserted,
      failed,
      moreRemaining: false,
      nextLeagueIndex: 0,
      pendingFixtureIds,
      reason: "already_complete",
    };
  }

  // Hard cap: never start a league import without import budget left.
  if (Date.now() - started >= AUTO_IMPORT_BUDGET_MS || budgetLeft() <= 800) {
    const state = {
      incomplete: true,
      nextLeagueIndex,
      gameweekId: gameweek.id,
      found,
      inserted,
      failed,
      pendingFixtureIds,
    };
    await writeImportProgress(db, { progress: state });
    return {
      ran: false,
      found,
      inserted,
      failed,
      moreRemaining: true,
      nextLeagueIndex,
      pendingFixtureIds,
      reason: "budget",
    };
  }

  const league = ULTIMA_LEAGUES[nextLeagueIndex];
  try {
    const one = await importMissingFixturesForGameweek(db, gameweek, { leagues: [league] });
    found += one.found ?? 0;
    inserted += one.inserted ?? 0;
    failed += one.failed ?? 0;
    for (const id of one.insertedFixtureIds ?? []) {
      if (!pendingFixtureIds.includes(id)) pendingFixtureIds.push(id);
    }
    nextLeagueIndex += 1;

    const moreRemaining = nextLeagueIndex < ULTIMA_LEAGUES.length;
    const savedIndex = moreRemaining ? nextLeagueIndex : 0;
    await writeImportProgress(db, {
      progress: {
        incomplete: moreRemaining,
        nextLeagueIndex: savedIndex,
        gameweekId: gameweek.id,
        found,
        inserted,
        failed,
        pendingFixtureIds,
        lastLeague: league,
      },
      error: one.ok === false ? one.error ?? "league_import_failed" : null,
    });

    console.info("[ultima/auto-sync]", {
      phase: "fixture_import",
      gameweekId: gameweek.id,
      league,
      found: one.found ?? 0,
      inserted: one.inserted ?? 0,
      failed: one.failed ?? 0,
      nextLeagueIndex: savedIndex,
      moreRemaining,
      pending: pendingFixtureIds.length,
    });

    return {
      ran: true,
      found,
      inserted,
      failed,
      moreRemaining,
      nextLeagueIndex: savedIndex,
      league,
      pendingFixtureIds,
    };
  } catch (err) {
    const message = err?.message ?? "fixture_import_failed";
    console.error("[ultima/auto-sync]", {
      phase: "fixture_import",
      league,
      error: message,
      nextLeagueIndex,
    });
    await writeImportProgress(db, {
      progress: {
        incomplete: true,
        nextLeagueIndex,
        gameweekId: gameweek.id,
        found,
        inserted,
        failed: failed + 1,
        pendingFixtureIds,
        lastLeague: league,
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
      league,
      pendingFixtureIds,
      error: message,
    };
  }
}

async function clearPendingFixtureIds(db, remainingIds) {
  const row = await readImportRow(db);
  const progress = progressFromRow(row);
  await writeImportProgress(db, {
    lastOkAt: row?.last_ok_at ?? undefined,
    progress: {
      ...progress,
      pendingFixtureIds: remainingIds,
    },
    error: row?.last_error ?? null,
  });
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
  if (isAbandonedStatus(fixture.status)) {
    await db.from("ultima_player_match_stats").delete().eq("fixture_id", fixture.id);
    return {
      fixtureId: fixture.id,
      league: fixture.league,
      status: "skipped",
      reason: "abandoned",
      written: 0,
      failed: 0,
      changed: true,
      unmatchedPlayers: [],
    };
  }
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
  const progress = progressFromRow(row);
  const sameGameweek = !progress.gameweekId || progress.gameweekId === gameweekId;
  const incomplete = Boolean(progress.incomplete) && sameGameweek;
  const pendingFixtureIds = pendingIdsFromProgress(progress);
  if (incomplete || !sameGameweek) {
    return { due: true, incomplete, pendingFixtureIds, row, progress };
  }
  if (!isFresh(row?.last_ok_at, now, AUTO_IMPORT_INTERVAL_MS)) {
    return { due: true, incomplete: false, pendingFixtureIds, row, progress };
  }
  return { due: false, incomplete: false, pendingFixtureIds, row, progress };
}

/** Oldest started gameweek that still has a live or finished fixture without final stats. */
async function oldestGameweekNeedingStats(db, competitionId) {
  const nowIso = new Date().toISOString();
  const { data: weeks } = await db
    .from("ultima_gameweeks")
    .select("*")
    .eq("competition_id", competitionId)
    .lte("window_start", nowIso)
    .order("number", { ascending: true });
  const started = weeks ?? [];
  if (!started.length) return null;

  const { data: fixtures } = await db
    .from("ultima_fixtures")
    .select("gameweek_id, league, status, stats_final")
    .in("gameweek_id", started.map((gw) => gw.id))
    .in("league", ULTIMA_LEAGUES)
    .eq("stats_final", false);

  const openIds = new Set();
  for (const row of fixtures ?? []) {
    if (needsAutoSync(row, { force: false })) openIds.add(row.gameweek_id);
  }
  return started.find((gw) => openIds.has(gw.id)) ?? null;
}

async function loadSeasonFixtures(db, competitionId) {
  const current = await getCurrentGameweek(competitionId);
  const { data: weeks, error: weekError } = await db
    .from("ultima_gameweeks")
    .select("id, number")
    .eq("competition_id", competitionId);
  if (weekError) return { error: weekError.message, current, fixtures: [] };
  const ids = (weeks ?? []).map((row) => row.id);
  if (!ids.length) return { current, fixtures: [] };

  const { data, error } = await db
    .from("ultima_fixtures")
    .select("*")
    .in("gameweek_id", ids)
    .in("league", ULTIMA_LEAGUES)
    .order("kickoff_at", { ascending: true })
    .range(0, 999);
  if (error) return { error: error.message, current, fixtures: data ?? [] };

  const fixtures = [...(data ?? [])];
  for (let from = 1000; fixtures.length === from; from += 1000) {
    const page = await db
      .from("ultima_fixtures")
      .select("*")
      .in("gameweek_id", ids)
      .in("league", ULTIMA_LEAGUES)
      .order("kickoff_at", { ascending: true })
      .range(from, from + 999);
    if (page.error) return { error: page.error.message, current, fixtures };
    fixtures.push(...(page.data ?? []));
    if ((page.data ?? []).length < 1000) break;
  }
  return { current, fixtures };
}

async function refreshFixtureStatus(db, fixture) {
  const provider = getStatsProvider();
  const smId = fixture.sportmonks_fixture_id;
  if (!smId || typeof provider.fetchFixtureById !== "function") {
    return null;
  }
  const remote = await provider.fetchFixtureById(smId, fixture.league);
  const raw = remote?.raw_status ?? remote?.status;
  if (!raw) return null;
  const status = storedStatusForRemote(raw);
  if (!status) {
    console.info("[ultima/auto-sync]", {
      fixture_id: fixture.id,
      stored_status: fixture.status ?? null,
      sportmonks_status: raw,
      unknown_state: true,
    });
    return { ...remote, status: fixture.status ?? null, raw_status: raw, unknown: true };
  }
  const patch = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (remote.home_score != null) patch.home_score = remote.home_score;
  if (remote.away_score != null) patch.away_score = remote.away_score;
  const { error } = await db.from("ultima_fixtures").update(patch).eq("id", fixture.id);
  if (error) throw new Error(error.message);
  if (isAbandonedStatus(status)) {
    await db.from("ultima_player_match_stats").delete().eq("fixture_id", fixture.id);
  }
  console.info("[ultima/auto-sync]", {
    fixture_id: fixture.id,
    stored_status: fixture.status ?? null,
    sportmonks_status: raw,
  });
  return { ...remote, status, raw_status: raw };
}

function autoSummary({
  gameweek = null,
  fixturesChecked = 0,
  fixturesScored = 0,
  playersUpdated = 0,
  cursor = null,
  remaining = 0,
  durationMs = 0,
  statusRefreshed = 0,
  statusRefresh = [],
  pendingRescore = [],
  playersLinked = null,
  gw1Totals = null,
  errors = [],
  ok = true,
}) {
  return {
    ok,
    gameweek,
    fixtures_checked: fixturesChecked,
    fixtures_scored: fixturesScored,
    players_updated: playersUpdated,
    cursor,
    remaining,
    duration_ms: durationMs,
    status_refreshed: statusRefreshed,
    status_refresh: statusRefresh,
    pending_rescore: pendingRescore,
    players_linked: playersLinked,
    gw1_totals: gw1Totals,
    errors,
  };
}

async function logAutoSummary(competitionId, summary) {
  try {
    await recordUltimaEvent({
      event: "auto_sync",
      competitionId,
      payload: summary,
    });
  } catch (err) {
    console.error("[ultima/auto-sync]", { event: "log_failed", error: err?.message });
  }
}

/**
 * Cron scoring. Same stat write and rescore as commissioner Resync
 * (`syncStatsForFixtures` inside `syncOneFixture`, then `recomputeGameweekScores`).
 * One saved queue, advanced every call. Import runs only when there is nothing to score.
 */
async function gameweekOneTotals(db, gameweekId) {
  const { data, error } = await db
    .from("ultima_manager_gameweek_scores")
    .select("points, bolt_points, ultima_managers(manager_name, team_name)")
    .eq("gameweek_id", gameweekId);
  if (error) return { error: error.message, totals: [] };
  const totals = (data ?? []).map((row) => {
    const points = Number(row.points ?? 0);
    const bolt = Number(row.bolt_points ?? 0);
    const manager = row.ultima_managers ?? {};
    return {
      manager: manager.team_name || manager.manager_name || "Manager",
      points,
      bolt,
      total: points + bolt,
    };
  }).sort((a, b) => b.total - a.total || a.manager.localeCompare(b.manager));
  return { totals };
}

/**
 * Link null stat rows, then score gameweek 1 once. Later calls skip this.
 * An unfinished link returns before any other scoring.
 */
async function repairUnlinkedStats(db, competitionId, progress, budgetLeft) {
  let linked = Number(progress.playersLinked ?? 0);
  let cursor = progress.statLinkCursor ?? null;
  let done = Boolean(progress.statLinkDone);

  if (!done) {
    const loaded = await loadPlayerIndex(db);
    if (loaded.error) return { ready: false, linked, error: loaded.error };
    while (budgetLeft() > 3000) {
      const page = await linkNullStatPlayers(db, { cursor, limit: 300, index: loaded.index });
      linked += page.linked ?? 0;
      cursor = page.cursor ?? cursor;
      if (page.done) done = true;
      await writeImportProgress(db, {
        progress: { playersLinked: linked, statLinkCursor: cursor, statLinkDone: done },
      });
      if (page.error) return { ready: false, linked, error: page.error };
      if (done) break;
    }
    if (!done) return { ready: false, linked };
  }

  if (progress.gw1RepairDone) return { ready: true, linked };

  const { data: gw, error: gwError } = await db
    .from("ultima_gameweeks")
    .select("id")
    .eq("competition_id", competitionId)
    .eq("number", 1)
    .maybeSingle();
  if (gwError || !gw?.id) {
    return { ready: false, linked, error: gwError?.message ?? "no_gw1" };
  }

  const scored = await recomputeGameweekScores(competitionId, gw.id);
  const totals = await gameweekOneTotals(db, gw.id);
  await writeImportProgress(db, {
    progress: {
      playersLinked: linked,
      statLinkCursor: cursor,
      statLinkDone: true,
      gw1RepairDone: Boolean(scored?.ok) && !totals.error,
    },
  });
  if (!scored?.ok || totals.error) {
    return { ready: false, linked, totals: totals.totals ?? [], error: scored?.error || totals.error || "gw1_rescore_failed" };
  }
  return { ready: true, linked, totals: totals.totals, fresh: true };
}

async function runAutoScorePass({ db, competition, started, budgetLeft, batchSize, rescore }) {
  const progress = progressFromRow(await readImportRow(db));
  const repair = await repairUnlinkedStats(db, competition.id, progress, budgetLeft);
  if (!repair.ready || repair.fresh) {
    const summary = autoSummary({
      gameweek: 1,
      durationMs: Date.now() - started,
      playersLinked: repair.linked,
      gw1Totals: repair.totals,
      errors: repair.error ? [repair.error] : [],
      ok: !repair.error,
    });
    await logAutoSummary(competition.id, summary);
    console.info("[ultima/auto-sync]", summary);
    return summary;
  }

  const settled = rescore
    ? await settlePendingRescores(progress.pendingRescore, (gameweekId) => (
      recomputeGameweekScores(competition.id, gameweekId)
    ))
    : { pending: [...(progress.pendingRescore ?? [])], errors: [] };
  let pendingRescore = settled.pending;
  const earlyErrors = settled.errors;

  const loaded = await loadSeasonFixtures(db, competition.id);
  if (loaded.error) {
    const summary = autoSummary({
      ok: false,
      durationMs: Date.now() - started,
      pendingRescore,
      errors: [loaded.error, ...earlyErrors],
    });
    await logAutoSummary(competition.id, summary);
    return summary;
  }

  const counts = await statsCountsForFixtures(db, loaded.fixtures.map((row) => row.id));
  const planned = await prepareAutoSyncBatch({
    fixtures: loaded.fixtures,
    statCounts: counts,
    currentGameweekId: loaded.current?.id ?? null,
    fetchStatus: (fixture) => refreshFixtureStatus(db, fixture),
    scoreBatchSize: Math.max(1, Math.min(Number(batchSize) || AUTO_SYNC_BATCH_SIZE, 8)),
    savedQueue: progress.scoreQueue,
    unchangedAt: progress.statusUnchangedAt ?? {},
    staleLive: progress.staleLive ?? {},
  });
  const queue = planned.queue ?? [];
  for (const row of planned.unknownStates ?? []) {
    await recordUltimaEvent({
      event: "auto_sync_unknown_state",
      competitionId: competition.id,
      payload: row,
    });
  }
  for (const row of planned.staleLiveEvents ?? []) {
    await recordUltimaEvent({
      event: "auto_sync_stale_live",
      competitionId: competition.id,
      payload: row,
    });
  }
  for (const gameweekId of planned.abandonedGameweeks ?? []) {
    pendingRescore = addPendingRescore(pendingRescore, gameweekId);
  }
  await writeImportProgress(db, {
    progress: {
      scoreQueue: queue,
      pendingRescore,
      statusUnchangedAt: planned.unchangedAt ?? {},
      staleLive: planned.staleLive ?? {},
    },
  });

  const base = {
    gameweek: loaded.current?.number ?? null,
    cursor: queue[0] ?? null,
    remaining: queue.length,
    statusRefreshed: planned.statusRefreshed,
    statusRefresh: planned.refreshLog ?? [],
    pendingRescore,
  };

  if (planned.skipScoring || budgetLeft() <= 500) {
    const summary = autoSummary({
      ...base,
      durationMs: Date.now() - started,
      errors: [...earlyErrors, ...(planned.errors ?? []), ...(budgetLeft() <= 500 && !planned.skipScoring ? ["budget"] : [])],
      ok: earlyErrors.length === 0 && (planned.errors ?? []).length === 0,
    });
    await logAutoSummary(competition.id, summary);
    console.info("[ultima/auto-sync]", summary);
    return summary;
  }

  const batch = planned.batch ?? [];
  const byId = new Map(batch.map((row) => [row.id, row]));

  if (!batch.length) {
    const summary = autoSummary({
      ...base,
      durationMs: Date.now() - started,
      errors: [...earlyErrors, ...(planned.errors ?? [])],
    });
    await logAutoSummary(competition.id, summary);
    console.info("[ultima/auto-sync]", summary);
    return summary;
  }

  const maps = await loadPlayerLookupMaps(db);
  const scoredResults = await Promise.all(
    batch.map(async (fixture) => {
      try {
        return await syncOneFixture(db, fixture, maps);
      } catch (err) {
        return {
          fixtureId: fixture.id,
          status: "failed",
          reason: err?.message ?? "fixture_failed",
          written: 0,
          changed: false,
        };
      }
    }),
  );

  const errors = [...earlyErrors, ...(planned.errors ?? [])];
  const failedIds = [];
  const changedByGameweek = new Map();
  let fixturesScored = 0;
  let playersUpdated = 0;

  for (const result of scoredResults) {
    playersUpdated += result.written ?? 0;
    if (result.status === "synced") fixturesScored += 1;
    if (result.status === "failed") {
      failedIds.push(result.fixtureId);
      errors.push(`${result.fixtureId}: ${result.reason || "failed"}`);
    }
    if (result.changed) {
      const fixture = byId.get(result.fixtureId);
      const gw = fixture?.gameweek_id;
      if (gw) {
        const list = changedByGameweek.get(gw) ?? [];
        list.push(result.fixtureId);
        changedByGameweek.set(gw, list);
      }
    }
  }

  const scored = [];
  for (const result of scoredResults) {
    const fixture = byId.get(result.fixtureId);
    const finished = fixture && isFinishedStatus(fixture.status) && result.status === "synced";
    let marked = false;
    if (finished) {
      const { error: markError } = await db
        .from("ultima_fixtures")
        .update({ stats_final: true, updated_at: new Date().toISOString() })
        .eq("id", result.fixtureId);
      if (markError) errors.push(`${result.fixtureId}: ${markError.message}`);
      else marked = true;
    }
    scored.push({
      id: result.fixtureId,
      status: fixture?.status,
      ok: finished ? marked : result.status === "synced",
    });
  }
  const nextQueue = nextScoreQueue(queue, scored);
  for (const id of failedIds) {
    if (!nextQueue.includes(id)) nextQueue.push(id);
  }

  if (rescore) {
    for (const [gameweekId, fixtureIds] of changedByGameweek) {
      if (budgetLeft() <= 400) {
        pendingRescore = addPendingRescore(pendingRescore, gameweekId);
        errors.push("rescore_deferred");
        break;
      }
      try {
        // Unset lineups start in draft order first so their players are scored too.
        const autoStarted = await autoStartUnsetLineups(db, gameweekId);
        if (autoStarted.error) errors.push(autoStarted.error);
        const owners = await managersOwningFixturePlayers(db, gameweekId, fixtureIds);
        if (!owners.length) continue;
        await recomputeGameweekScores(competition.id, gameweekId, { managerIds: owners });
        pendingRescore = clearPendingRescore(pendingRescore, gameweekId);
      } catch (err) {
        pendingRescore = addPendingRescore(pendingRescore, gameweekId);
        errors.push(err?.message ?? "rescore_failed");
      }
    }
  }

  await writeImportProgress(db, {
    progress: {
      scoreQueue: nextQueue,
      pendingRescore,
      statusUnchangedAt: planned.unchangedAt ?? {},
      staleLive: planned.staleLive ?? {},
    },
  });

  const scoredFixture = batch[0];
  let gameweekNumber = loaded.current?.number ?? null;
  if (scoredFixture?.gameweek_id) {
    const { data: gw } = await db
      .from("ultima_gameweeks")
      .select("number")
      .eq("id", scoredFixture.gameweek_id)
      .maybeSingle();
    if (gw?.number != null) gameweekNumber = gw.number;
  }

  const summary = autoSummary({
    gameweek: gameweekNumber,
    fixturesChecked: batch.length,
    fixturesScored,
    playersUpdated,
    cursor: nextQueue[0] ?? null,
    remaining: nextQueue.length,
    durationMs: Date.now() - started,
    statusRefreshed: planned.statusRefreshed,
    statusRefresh: planned.refreshLog ?? [],
    pendingRescore,
    errors,
    ok: errors.length === 0,
  });
  await logAutoSummary(competition.id, summary);
  console.info("[ultima/auto-sync]", summary);
  return summary;
}

/**
 * Sync live and unfinished FT fixtures for the current (or given) gameweek.
 * Cron: refresh stale statuses, then score up to 3 full-time or live
 * fixtures that have no player rows, current gameweek first.
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

  if (!backfill && !force) {
    const competitionForCron = await getActiveCompetition();
    if (!competitionForCron) {
      const summary = autoSummary({
        durationMs: Date.now() - started,
        errors: ["no_competition"],
      });
      return summary;
    }
    return runAutoScorePass({
      db,
      competition: competitionForCron,
      started,
      budgetLeft,
      batchSize,
      rescore,
    });
  }

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
    gameweek = await oldestGameweekNeedingStats(db, competition.id);
    if (!gameweek) gameweek = await getCurrentGameweek(competition.id);
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
    const leagueIndex = ULTIMA_LEAGUES.length + cursorNum;
    const league = ULTIMA_LEAGUES[leagueIndex];
    if (league) {
      try {
        const imported = await importMissingFixturesForGameweek(db, gameweek, { leagues: [league] });
        fixturesImported = imported.found ?? 0;
        missingImported = imported.inserted ?? 0;
        importResult = {
          ran: true,
          found: imported.found ?? 0,
          inserted: imported.inserted ?? 0,
          failed: imported.failed ?? 0,
          league,
          moreRemaining: true,
        };
      } catch (err) {
        importResult = {
          ran: true,
          found: 0,
          inserted: 0,
          failed: 1,
          league,
          moreRemaining: true,
          error: err?.message ?? "fixture_import_failed",
        };
        console.error("[ultima/auto-sync]", {
          phase: "fixture_import",
          backfill: true,
          league,
          error: importResult.error,
        });
      }
      const elapsedMs = Date.now() - started;
      const nextCursor = cursorNum + 1;
      console.info("[ultima/auto-sync]", {
        phase: "fixture_import",
        backfill: true,
        gameweekId: gameweek.id,
        league,
        found: importResult.found,
        inserted: importResult.inserted,
        failed: importResult.failed,
        nextCursor,
        elapsedMs,
      });
      return {
        ok: (importResult.failed ?? 0) === 0,
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
        failed: importResult.failed ?? 0,
        managers: 0,
        fixtures: [],
        unmatchedPlayers: [],
        ligue1Unmatched: [],
        moreRemaining: true,
        nextCursor: nextCursor < 0 ? nextCursor : 0,
        elapsedMs,
      };
    }
  } else if (!force && !backfill) {
    // Cron path: cheap gate so idle 5-minute calls stay instant.
    const now = Date.now();
    const importGate = await importDueOrIncomplete(db, gameweek.id, now);
    const { data: peekRows } = await db
      .from("ultima_fixtures")
      .select("id, league, status, stats_final, kickoff_at")
      .eq("gameweek_id", gameweek.id)
      .in("league", ULTIMA_LEAGUES);
    const peekCandidates = (peekRows ?? []).filter((row) => needsAutoSync(row, { force: false }));
    const pendingPeek = importGate.pendingFixtureIds ?? [];

    if (!importGate.due && !peekCandidates.length && !pendingPeek.length) {
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
      importResult = emptyImportResult({
        skipped: true,
        reason: "not_due",
        pendingFixtureIds: pendingPeek,
      });
    }
  }

  const { data: rows, error } = await db
    .from("ultima_fixtures")
    .select("*")
    .eq("gameweek_id", gameweek.id)
    .in("league", ULTIMA_LEAGUES)
    .order("kickoff_at", { ascending: true });
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

  const candidateMap = new Map();
  for (const row of allRows) {
    if (backfill ? needsBackfillSync(row, statsCounts) : needsAutoSync(row, { force })) {
      candidateMap.set(row.id, row);
    }
  }

  // Newly imported fixtures (often outside the 4h window) sync on later calls.
  let pendingFixtureIds = importResult.pendingFixtureIds ?? [];
  if (!force && !backfill) {
    if (!pendingFixtureIds.length) {
      const gateRow = await readImportRow(db);
      pendingFixtureIds = pendingIdsFromProgress(progressFromRow(gateRow));
    }
    if (pendingFixtureIds.length) {
      const { data: pendingRows } = await db
        .from("ultima_fixtures")
        .select("*")
        .in("id", pendingFixtureIds);
      const keep = [];
      for (const row of pendingRows ?? []) {
        // Only live/FT rows need stats; NS drops out and joins via the kickoff window later.
        if (needsAutoSync(row, { force: false })) {
          candidateMap.set(row.id, row);
          keep.push(row.id);
        }
      }
      if (keep.length !== pendingFixtureIds.length) {
        pendingFixtureIds = keep;
        await clearPendingFixtureIds(db, keep);
        importResult = { ...importResult, pendingFixtureIds: keep };
      }
    }
  }

  const candidates = [...candidateMap.values()].sort((a, b) => {
    const at = new Date(a.kickoff_at ?? 0).getTime();
    const bt = new Date(b.kickoff_at ?? 0).getTime();
    return at - bt;
  });

  if (!candidates.length) {
    const elapsedMs = Date.now() - started;
    const importMore = Boolean(importResult.moreRemaining);
    const pendingMore = pendingFixtureIds.length > 0;
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
      noop: !importResult.ran && !importMore && !pendingMore,
      reason: importMore ? "import_more_remaining" : "nothing_to_sync",
      gameweekId: gameweek.id,
      gameweek: gameweek.number,
      fixturesImported,
      missingImported,
      import: importResult,
      fixtures: [],
      unmatchedPlayers: [],
      moreRemaining: importMore || pendingMore,
      nextCursor: 0,
      elapsedMs,
    };
  }

  const size = Math.max(1, Math.min(Number(batchSize) || AUTO_SYNC_BATCH_SIZE, 8));
  let savedStatsCursor = 0;
  if (!force && !backfill) {
    const progress = progressFromRow(await readImportRow(db));
    savedStatsCursor = progress.statsGameweekId === gameweek.id
      ? (Number(progress.statsCursor) || 0)
      : 0;
    if (savedStatsCursor >= candidates.length) savedStatsCursor = 0;
  }
  const start = (force || backfill)
    ? Math.max(0, cursorNum < 0 ? 0 : cursorNum)
    : savedStatsCursor;

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

  // Drop pending imports that this call finished (keep failures for a later retry).
  if (!force && !backfill && pendingFixtureIds.length) {
    const done = new Set(
      settled
        .filter((result) => result.status === "synced" || result.status === "skipped")
        .map((result) => result.fixtureId),
    );
    if (done.size) {
      const remaining = pendingFixtureIds.filter((id) => !done.has(id));
      pendingFixtureIds = remaining;
      await clearPendingFixtureIds(db, remaining);
      importResult = { ...importResult, pendingFixtureIds: remaining };
    }
  }

  const statsMore = start + batch.length < candidates.length;
  const pendingMore = !force && !backfill && pendingFixtureIds.length > 0;
  const moreRemaining = statsMore || Boolean(importResult.moreRemaining) || pendingMore;
  const nextCursor = statsMore ? start + batch.length : 0;
  if (!force && !backfill) {
    await writeImportProgress(db, {
      progress: { statsCursor: nextCursor, statsGameweekId: gameweek.id },
    });
  }

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
