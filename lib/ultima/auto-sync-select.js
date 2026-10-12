import { ULTIMA_LEAGUES } from "./constants.js";
import { isFinishedStatus, isLiveStatus, normalizeFixtureStatus } from "./fixture-status.js";

export const AUTO_STATUS_REFRESH_LIMIT = 10;
export const AUTO_STATUS_REFRESH_BUDGET_MS = 4_000;

/** Kickoff has passed and the stored status is not full time. */
export function fixtureNeedsStatusRefresh(fixture, now = new Date()) {
  if (!ULTIMA_LEAGUES.includes(fixture?.league)) return false;
  const kickoff = new Date(fixture?.kickoff_at ?? fixture?.kickoff ?? 0).getTime();
  const t = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (!Number.isFinite(kickoff) || kickoff >= t) return false;
  const raw = fixture?.status;
  if (raw == null || String(raw).trim() === "") return true;
  const status = normalizeFixtureStatus(raw);
  if (isFinishedStatus(status)) return false;
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
 * Continue a saved queue. Finished ids drop off. New ids append.
 * The head is never rewound to the start of the same list.
 */
export function mergeScoreQueue(savedQueue, needingIds) {
  const needing = new Set(needingIds);
  const queue = (savedQueue ?? []).filter((id) => needing.has(id));
  const queued = new Set(queue);
  for (const id of needingIds) {
    if (!queued.has(id)) queue.push(id);
  }
  return queue;
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
}) {
  const started = Date.now();
  const updated = new Map((fixtures ?? []).map((row) => [row.id, { ...row }]));
  const toRefresh = (fixtures ?? [])
    .filter((row) => fixtureNeedsStatusRefresh(row, now))
    .sort((a, b) => new Date(a.kickoff_at ?? 0) - new Date(b.kickoff_at ?? 0))
    .slice(0, refreshLimit);

  let statusRefreshed = 0;
  const errors = [];
  for (const fixture of toRefresh) {
    if (Date.now() - started > refreshBudgetMs) {
      return {
        statusRefreshed,
        skipScoring: true,
        batch: [],
        queue: savedQueue ?? [],
        fixtures: updated,
        errors,
      };
    }
    try {
      const remote = await fetchStatus(fixture);
      const status = normalizeFixtureStatus(remote?.status);
      if (remote?.status) {
        updated.set(fixture.id, { ...updated.get(fixture.id), status, ...scorePatch(remote) });
        statusRefreshed += 1;
      }
    } catch (err) {
      errors.push(`${fixture.id}: ${err?.message ?? "status_refresh_failed"}`);
    }
  }

  if (Date.now() - started > refreshBudgetMs) {
    return {
      statusRefreshed,
      skipScoring: true,
      batch: [],
      queue: savedQueue ?? [],
      fixtures: updated,
      errors,
    };
  }

  const needing = [...updated.values()].filter((row) => (
    fixtureNeedsUnscored(row, statCounts.get(row.id) ?? 0)
  ));
  const ordered = orderUnscoredFixtures(needing, currentGameweekId);
  const queue = mergeScoreQueue(savedQueue, ordered.map((row) => row.id));
  const batchIds = queue.slice(0, scoreBatchSize);
  return {
    statusRefreshed,
    skipScoring: false,
    batch: batchIds.map((id) => updated.get(id)).filter(Boolean),
    queue,
    fixtures: updated,
    errors,
  };
}

function scorePatch(remote) {
  const patch = {};
  if (remote?.home_score != null) patch.home_score = remote.home_score;
  if (remote?.away_score != null) patch.away_score = remote.away_score;
  return patch;
}
