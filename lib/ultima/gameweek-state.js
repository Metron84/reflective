import { isFinishedStatus, isLiveStatus, isNonPlayingStatus, normalizeFixtureStatus } from "./fixture-status.js";
import {
  STUCK_FINAL_MS,
  allLeaguesSettled,
  anyLeagueKickoffStarted,
  isMatchdayFinal,
} from "./matchday-state.js";

/** Sportmonks does not send a whistle time. Full time is kickoff plus two hours. */
export const MATCH_LENGTH_MS = 2 * 60 * 60 * 1000;
/** Spec: a gameweek stays provisional for 24 hours after the last full time. */
export const CORRECTION_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Live, or kicked off inside this window, still needs a stat pull. */
export const LIVE_STATS_WINDOW_MS = 5 * 60 * 60 * 1000;

function kickoffMs(fixture) {
  const t = new Date(fixture?.kickoff_at ?? fixture?.kickoff).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * Estimated full-time of the latest settled fixture, or null.
 * Finished statuses use kickoff + 2h; stuck fixtures use kickoff + 4h.
 */
export function lastFullTimeMs(fixtures, now = Date.now()) {
  let last = null;
  for (const fixture of fixtures ?? []) {
    if (isNonPlayingStatus(fixture.status)) continue;
    const kick = kickoffMs(fixture);
    if (kick == null) continue;
    let ft = null;
    if (isFinishedStatus(fixture.status)) {
      ft = kick + MATCH_LENGTH_MS;
    } else if (isMatchdayFinal(fixture, now)) {
      ft = kick + STUCK_FINAL_MS;
    }
    if (ft != null && (last == null || ft > last)) last = ft;
  }
  return last;
}

/**
 * upcoming → live → provisional → final.
 * Live at the first real kickoff across the five leagues (not window_start).
 * Provisional when every league is DONE or has no non-void fixtures.
 * Final 24 hours after the last full time / stuck-final mark.
 */
export function nextGameweekState(gameweek, fixtures, now = Date.now()) {
  if (!gameweek) return null;
  const list = fixtures ?? [];
  let next = gameweek.state;

  if (gameweek.state === "upcoming" && anyLeagueKickoffStarted(list, now)) {
    next = "live";
  }

  const settled = allLeaguesSettled(list, now);
  if ((gameweek.state === "live" || next === "live") && settled) {
    next = "provisional";
  }

  const lastFt = lastFullTimeMs(list, now);
  const correctionClosed = lastFt != null && now >= lastFt + CORRECTION_WINDOW_MS;
  if ((next === "provisional" || gameweek.state === "provisional") && settled && correctionClosed) {
    next = "final";
  }

  return next;
}

/**
 * A fixture worth asking Sportmonks about on the short live route.
 * Live, kicked off in the last 5 hours, or FT while the gameweek is not final
 * and still inside the correction window.
 */
export function fixtureNeedsLiveStats(fixture, gameweekState, now = Date.now()) {
  const status = normalizeFixtureStatus(fixture?.status);
  if (status == null || isNonPlayingStatus(fixture?.status)) return false;
  if (isLiveStatus(status)) return true;
  const kick = kickoffMs(fixture);
  if (kick == null || now < kick) return false;
  const age = now - kick;
  if (age <= LIVE_STATS_WINDOW_MS) return true;
  const inCorrection = age <= LIVE_STATS_WINDOW_MS + CORRECTION_WINDOW_MS + MATCH_LENGTH_MS;
  return isFinishedStatus(status) && gameweekState !== "final" && inCorrection;
}
