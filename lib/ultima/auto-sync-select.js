import { ULTIMA_LEAGUES } from "./constants.js";
import { isFinishedStatus, isLiveStatus, normalizeFixtureStatus } from "./fixture-status.js";

/** Finished fixtures in this window are scored even when they sit outside the current gameweek. */
export const AUTO_SCORE_LOOKBACK_MS = 48 * 60 * 60 * 1000;

/** A live or finished fixture still needs Sportmonks player stats. FT is included. */
export function fixtureNeedsPlayerScores(fixture, statsCount = 0) {
  if (!ULTIMA_LEAGUES.includes(fixture?.league)) return false;
  const status = normalizeFixtureStatus(fixture.status);
  if (!isLiveStatus(status) && !isFinishedStatus(status)) return false;
  if ((statsCount ?? 0) === 0) return true;
  return !fixture.stats_final;
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
