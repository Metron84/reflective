/**
 * Server loader for per-league matchday state. Reads synced ultima_fixtures.
 */
import {
  computeAllLeagueMatchdayStates,
  computeLeagueMatchdayState,
} from "@/lib/ultima/matchday-state";
import { getReadDb } from "@/lib/ultima/server/strict-db";

async function loadGameweekFixtures(gameweekId) {
  const db = getReadDb();
  if (!db || !gameweekId) return [];
  const { data, error } = await db
    .from("ultima_fixtures")
    .select("id, league, status, kickoff, kickoff_at")
    .eq("gameweek_id", gameweekId);
  if (error) {
    console.error("[ultima/matchday-state] fixtures", error.message);
    return [];
  }
  return data ?? [];
}

/**
 * Single authority: one league's matchday state for a gameweek.
 * @returns {Promise<'UPCOMING'|'LOCKED'|'LIVE'|'DONE'>}
 */
export async function getLeagueMatchdayState(competitionId, leagueId, gameweekId, now = Date.now()) {
  if (!competitionId || !leagueId || !gameweekId) return "UPCOMING";
  const fixtures = await loadGameweekFixtures(gameweekId);
  return computeLeagueMatchdayState(
    fixtures.filter((f) => f.league === leagueId),
    now,
  );
}

/** All five leagues for one gameweek. */
export async function getGameweekLeagueStates(competitionId, gameweekId, now = Date.now()) {
  if (!competitionId || !gameweekId) {
    return computeAllLeagueMatchdayStates([], now);
  }
  const fixtures = await loadGameweekFixtures(gameweekId);
  return {
    states: computeAllLeagueMatchdayStates(fixtures, now),
    fixtures,
  };
}
