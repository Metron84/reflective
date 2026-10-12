import { ULTIMA_LEAGUES } from "./constants.js";
import {
  isAbandonedStatus,
  isFinishedStatus,
  isLiveStatus,
  isNonPlayingStatus,
  normalizeFixtureStatus,
  storedStatusForRemote,
} from "./fixture-status.js";

export { storedStatusForRemote };

export const AUTO_STATUS_REFRESH_LIMIT = 10;
export const AUTO_STATUS_REFRESH_BUDGET_MS = 4_000;
export const AUTO_STATUS_UNCHANGED_MS = 30 * 60 * 1000;
export const STALE_LIVE_MS = 3 * 60 * 60 * 1000;

/**
 * These four were stored as POSTP on 13 Oct 2026 because "2nd" and "ABAN"
 * were not recognised. Refresh them once so the stored status matches Sportmonks.
 */
const CORRECT_MISREAD_POSTP = new Set([
  "f65ebbac-0202-4b8d-9766-aada15d1d3cc",
  "7469aa12-c794-4b7e-bd53-8f58aed713a2",
  "4ec018f3-676c-4e01-97ec-12e815d4c9e8",
  "af90dcc1-5baf-4046-9dea-0b19b1d5f0b9",
]);

export function isStaleLive(fixture, now = new Date(), staleMs = STALE_LIVE_MS) {
  if (!isLiveStatus(fixture?.status)) return false;
  const kickoff = new Date(fixture?.kickoff_at ?? fixture?.kickoff ?? 0).getTime();
  const t = now instanceof Date ? now.getTime() : new Date(now).getTime();
  return Number.isFinite(kickoff) && t - kickoff > staleMs;
}

/** Abandoned rows never score. A later replay fixture for the same clubs does. */
export function fixturesThatScore(fixtures) {
  return (fixtures ?? []).filter((fixture) => !isAbandonedStatus(fixture?.status));
}

/** Kickoff has passed and the stored status is not full time. Unchanged rows wait 30 minutes. */
export function fixtureNeedsStatusRefresh(fixture, now = new Date(), { unchangedAt = null } = {}) {
  if (!ULTIMA_LEAGUES.includes(fixture?.league)) return false;
  const kickoff = new Date(fixture?.kickoff_at ?? fixture?.kickoff ?? 0).getTime();
  const t = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (!Number.isFinite(kickoff) || kickoff >= t) return false;
  if (unchangedAt) {
    const seen = new Date(unchangedAt).getTime();
    if (Number.isFinite(seen) && t - seen < AUTO_STATUS_UNCHANGED_MS) return false;
  }
  const raw = fixture?.status;
  if (CORRECT_MISREAD_POSTP.has(fixture?.id)) {
    const current = normalizeFixtureStatus(raw);
    if (current === "POSTP" || current === "CANC") return true;
  }
  if (raw == null || String(raw).trim() === "") return true;
  const status = normalizeFixtureStatus(raw);
  if (isFinishedStatus(status)) return false;
  if (status === "POSTP" || status === "CANC" || isNonPlayingStatus(raw)) return false;
  return status === "NS" || isLiveStatus(status);
}

/**
 * Live fixtures stay queued until full time.
 * Full time stays queued until stats_final, even when player rows already exist.
 */
export function fixtureNeedsUnscored(fixture, statsCount = 0) {
  if (!ULTIMA_LEAGUES.includes(fixture?.league)) return false;
  const status = normalizeFixtureStatus(fixture?.status);
  if (isLiveStatus(status)) return true;
  if (!isFinishedStatus(status)) return false;
  if (fixture?.stats_final) return false;
  return true;
}

/**
 * Drop full-time fixtures that were just scored. Live fixtures stay, moved
 * behind the rest so the queue still advances.
 */
export function nextScoreQueue(queue, scored) {
  const byId = new Map((scored ?? []).map((row) => [row.id, row]));
  const rest = [];
  const live = [];
  for (const id of queue ?? []) {
    const row = byId.get(id);
    if (row?.ok && isFinishedStatus(row.status)) continue;
    if (row?.ok && isLiveStatus(row.status)) {
      live.push(id);
      continue;
    }
    rest.push(id);
  }
  return [...rest, ...live];
}

/** Replace rows on fixture + player. A second write does not add to the first. */
export function upsertPlayerScores(existing, incoming) {
  const map = new Map();
  for (const row of [...(existing ?? []), ...(incoming ?? [])]) {
    map.set(`${row.fixture_id}:${row.player_id}`, { ...row });
  }
  return [...map.values()];
}

/** Current gameweek first, then oldest kickoff. */
export function orderUnscoredFixtures(fixtures, currentGameweekId) {
  return [...fixtures].sort((a, b) => {
    const aCur = currentGameweekId && a.gameweek_id === currentGameweekId ? 0 : 1;
    const bCur = currentGameweekId && b.gameweek_id === currentGameweekId ? 0 : 1;
    if (aCur !== bCur) return aCur - bCur;
    return new Date(a.kickoff_at ?? 0) - new Date(b.kickoff_at ?? 0);
  });
}

/**
 * Keep every saved id. New ids append. Only a successful score removes an id.
 */
export function mergeScoreQueue(savedQueue, needingIds) {
  const queue = [...(savedQueue ?? [])];
  const queued = new Set(queue);
  for (const id of needingIds ?? []) {
    if (!queued.has(id)) queue.push(id);
  }
  return queue;
}

export function addPendingRescore(list, gameweekId) {
  const next = [...(list ?? [])];
  if (gameweekId && !next.includes(gameweekId)) next.push(gameweekId);
  return next;
}

export function clearPendingRescore(list, gameweekId) {
  return (list ?? []).filter((id) => id !== gameweekId);
}

export async function settlePendingRescores(list, recompute) {
  let pending = [...(list ?? [])];
  const errors = [];
  for (const gameweekId of [...pending]) {
    try {
      await recompute(gameweekId);
      pending = clearPendingRescore(pending, gameweekId);
    } catch (err) {
      errors.push(err?.message ?? "rescore_failed");
    }
  }
  return { pending, errors };
}

/**
 * Refresh stale statuses, then pick the next score batch.
 * If the refresh exceeds the budget, scoring is skipped for this call.
 */
export async function prepareAutoSyncBatch({
  fixtures,
  statCounts = new Map(),
  currentGameweekId = null,
  now = new Date(),
  fetchStatus,
  refreshLimit = AUTO_STATUS_REFRESH_LIMIT,
  refreshBudgetMs = AUTO_STATUS_REFRESH_BUDGET_MS,
  scoreBatchSize = 3,
  savedQueue = [],
  unchangedAt = {},
  staleLive = {},
}) {
  const started = Date.now();
  const t = now instanceof Date ? now : new Date(now);
  const updated = new Map((fixtures ?? []).map((row) => [row.id, { ...row }]));
  const holds = { ...(unchangedAt ?? {}) };
  const stale = { ...(staleLive ?? {}) };
  for (const [id, flag] of Object.entries(stale)) {
    const row = updated.get(id);
    if (!row) continue;
    const same = normalizeFixtureStatus(row.status) === normalizeFixtureStatus(flag?.status);
    if (!same || !isLiveStatus(row.status)) delete stale[id];
  }

  const regular = (fixtures ?? [])
    .filter((row) => fixtureNeedsStatusRefresh(row, t, { unchangedAt: holds[row.id] }));
  const staleOnce = (fixtures ?? [])
    .filter((row) => isStaleLive(row, t) && !stale[row.id]);
  const seen = new Set();
  const toRefresh = [...staleOnce, ...regular]
    .filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    })
    .sort((a, b) => new Date(a.kickoff_at ?? 0) - new Date(b.kickoff_at ?? 0))
    .slice(0, refreshLimit);

  let statusRefreshed = 0;
  const errors = [];
  const refreshLog = [];
  const unknownStates = [];
  const staleLiveEvents = [];
  const abandonedGameweeks = [];
  for (const fixture of toRefresh) {
    if (Date.now() - started > refreshBudgetMs) break;
    try {
      const remote = await fetchStatus(fixture);
      const raw = remote?.raw_status ?? remote?.status ?? null;
      refreshLog.push({
        id: fixture.id,
        stored_status: fixture.status ?? null,
        sportmonks_status: raw,
      });
      if (!raw) continue;
      const status = storedStatusForRemote(raw);
      if (!status) {
        unknownStates.push({
          fixture_id: fixture.id,
          stored_status: fixture.status ?? null,
          sportmonks_status: raw,
        });
        holds[fixture.id] = t.toISOString();
        continue;
      }
      const previous = normalizeFixtureStatus(fixture.status);
      const next = { ...updated.get(fixture.id), status, ...scorePatch(remote) };
      updated.set(fixture.id, next);
      statusRefreshed += 1;
      if (normalizeFixtureStatus(status) === previous) holds[fixture.id] = t.toISOString();
      else delete holds[fixture.id];
      if (isAbandonedStatus(status) && !isAbandonedStatus(fixture.status)) {
        if (fixture.gameweek_id) abandonedGameweeks.push(fixture.gameweek_id);
      }
      if (isStaleLive(next, t)) {
        if (!stale[fixture.id]) {
          staleLiveEvents.push({
            fixture_id: fixture.id,
            kickoff_at: fixture.kickoff_at ?? fixture.kickoff ?? null,
            status,
          });
        }
        stale[fixture.id] = { status, at: t.toISOString() };
      } else {
        delete stale[fixture.id];
      }
    } catch (err) {
      errors.push(`${fixture.id}: ${err?.message ?? "status_refresh_failed"}`);
    }
  }

  const skipScoring = Date.now() - started > refreshBudgetMs;
  const needing = [...updated.values()].filter((row) => (
    fixtureNeedsUnscored(row, statCounts.get(row.id) ?? 0)
    && !isAbandonedStatus(row.status)
    && !(stale[row.id] && isLiveStatus(row.status))
  ));
  const ordered = orderUnscoredFixtures(needing, currentGameweekId);
  const queue = mergeScoreQueue(savedQueue, ordered.map((row) => row.id)).filter((id) => {
    const row = updated.get(id);
    if (!row) return true;
    if (isAbandonedStatus(row.status)) return false;
    if (stale[id] && isLiveStatus(row.status)) return false;
    return true;
  });
  const batchIds = [];
  if (!skipScoring) {
    for (const id of queue) {
      if (batchIds.length >= scoreBatchSize) break;
      if (updated.has(id)) batchIds.push(id);
    }
  }
  return {
    statusRefreshed,
    skipScoring,
    batch: batchIds.map((id) => updated.get(id)).filter(Boolean),
    queue,
    fixtures: updated,
    errors,
    refreshLog,
    unchangedAt: holds,
    unknownStates,
    staleLive: stale,
    staleLiveEvents,
    abandonedGameweeks,
  };
}

function scorePatch(remote) {
  const patch = {};
  if (remote?.home_score != null) patch.home_score = remote.home_score;
  if (remote?.away_score != null) patch.away_score = remote.away_score;
  return patch;
}
