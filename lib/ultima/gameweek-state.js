import { isFinishedStatus, isLiveStatus, normalizeFixtureStatus } from "./fixture-status.js";

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

/** Estimated full-time timestamp of the latest FT fixture, or null. */
export function lastFullTimeMs(fixtures) {
  let last = null;
  for (const fixture of fixtures ?? []) {
    if (!isFinishedStatus(fixture.status)) continue;
    const kick = kickoffMs(fixture);
    if (kick == null) continue;
    const ft = kick + MATCH_LENGTH_MS;
    if (last == null || ft > last) last = ft;
  }
  return last;
}

/**
 * upcoming → live → provisional → final.
 * Final only when every fixture is FT and 24 hours have passed since the last full time.
 */
export function nextGameweekState(gameweek, fixtures, now = Date.now()) {
  if (!gameweek) return null;
  const list = fixtures ?? [];
  let next = gameweek.state;
  const windowStart = new Date(gameweek.window_start).getTime();

  if (gameweek.state === "upcoming" && Number.isFinite(windowStart) && now >= windowStart) {
    next = "live";
  }

  const allFinished = list.length > 0 && list.every((fixture) => isFinishedStatus(fixture.status));

  if ((gameweek.state === "live" || next === "live") && allFinished) {
    next = "provisional";
  }

  const lastFt = lastFullTimeMs(list);
  const correctionClosed = lastFt != null && now >= lastFt + CORRECTION_WINDOW_MS;
  if ((next === "provisional" || gameweek.state === "provisional") && allFinished && correctionClosed) {
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
  if (status === "POSTP" || status === "CANC") return false;
  if (isLiveStatus(status)) return true;
  const kick = kickoffMs(fixture);
  if (kick == null || now < kick) return false;
  const age = now - kick;
  if (age <= LIVE_STATS_WINDOW_MS) return true;
  const inCorrection = age <= LIVE_STATS_WINDOW_MS + CORRECTION_WINDOW_MS + MATCH_LENGTH_MS;
  return isFinishedStatus(status) && gameweekState !== "final" && inCorrection;
}
