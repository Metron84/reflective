/**
 * Per-league matchday state. Pure. Single authority for lock / LIVE / DONE.
 * Server loader: lib/ultima/server/matchday-state.js
 */
import { ULTIMA_LEAGUES } from "./constants.js";
import { isFinishedStatus, isLiveStatus, isNonPlayingStatus } from "./fixture-status.js";

export const MATCHDAY_UPCOMING = "UPCOMING";
export const MATCHDAY_LOCKED = "LOCKED";
export const MATCHDAY_LIVE = "LIVE";
export const MATCHDAY_DONE = "DONE";

/** A fixture still not final this long after kickoff counts as final. */
export const STUCK_FINAL_MS = 4 * 60 * 60 * 1000;

function kickoffMs(fixture) {
  const t = new Date(fixture?.kickoff_at ?? fixture?.kickoff).getTime();
  return Number.isFinite(t) ? t : null;
}

/** Postponed, cancelled, suspended, abandoned: ignored for locking. */
export function isVoidFixture(fixture) {
  return isNonPlayingStatus(fixture?.status);
}

/** Active (non-void) fixtures for one league. */
export function activeFixtures(fixtures) {
  return (fixtures ?? []).filter((f) => !isVoidFixture(f));
}

/**
 * Final for lock purposes: FT / AET / FT_PEN (finished bucket), or stuck
 * past kickoff + 4 hours without a final state.
 */
export function isMatchdayFinal(fixture, now = Date.now()) {
  if (isVoidFixture(fixture)) return false;
  if (isFinishedStatus(fixture?.status)) return true;
  const kick = kickoffMs(fixture);
  if (kick == null) return false;
  return now >= kick + STUCK_FINAL_MS;
}

/** In play right now, and not past the stuck-final fallback. */
export function isMatchdayInPlay(fixture, now = Date.now()) {
  if (isVoidFixture(fixture) || isMatchdayFinal(fixture, now)) return false;
  return isLiveStatus(fixture?.status);
}

function hasKickedOff(fixture, now) {
  if (isMatchdayInPlay(fixture, now) || isMatchdayFinal(fixture, now)) return true;
  const kick = kickoffMs(fixture);
  return kick != null && kick <= now;
}

/**
 * State for one league from its fixtures this gameweek.
 * Zero fixtures (or only void) → UPCOMING, never LOCKED or LIVE.
 */
export function computeLeagueMatchdayState(fixtures, now = Date.now()) {
  const active = activeFixtures(fixtures);
  if (!active.length) return MATCHDAY_UPCOMING;

  if (!active.some((f) => hasKickedOff(f, now))) return MATCHDAY_UPCOMING;

  if (active.every((f) => isMatchdayFinal(f, now))) return MATCHDAY_DONE;

  if (active.some((f) => isMatchdayInPlay(f, now))) return MATCHDAY_LIVE;

  return MATCHDAY_LOCKED;
}

/** All five leagues. Missing leagues with no rows → UPCOMING. */
export function computeAllLeagueMatchdayStates(fixtures, now = Date.now()) {
  const list = fixtures ?? [];
  const out = {};
  for (const league of ULTIMA_LEAGUES) {
    out[league] = computeLeagueMatchdayState(
      list.filter((f) => f.league === league),
      now,
    );
  }
  return out;
}

/** LOCKED or LIVE: XV slots for this league are frozen on the current gameweek. */
export function isMatchdayLocked(state) {
  return state === MATCHDAY_LOCKED || state === MATCHDAY_LIVE;
}

export function lockedLeagueIds(states) {
  return ULTIMA_LEAGUES.filter((league) => isMatchdayLocked(states?.[league]));
}

/**
 * Settled for gameweek completion: DONE, or no non-void fixtures (idle / all void).
 * UPCOMING with fixtures still to play is not settled.
 */
export function isLeagueSettledForGameweek(state, fixturesForLeague) {
  if (state === MATCHDAY_DONE) return true;
  return activeFixtures(fixturesForLeague).length === 0;
}

export function allLeaguesSettled(fixtures, now = Date.now()) {
  const list = fixtures ?? [];
  for (const league of ULTIMA_LEAGUES) {
    const rows = list.filter((f) => f.league === league);
    const state = computeLeagueMatchdayState(rows, now);
    if (!isLeagueSettledForGameweek(state, rows)) return false;
  }
  return true;
}

/** True when any non-void fixture across the five has kicked off. */
export function anyLeagueKickoffStarted(fixtures, now = Date.now()) {
  return activeFixtures(fixtures).some((f) => hasKickedOff(f, now));
}
