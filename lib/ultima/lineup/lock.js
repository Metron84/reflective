import { isMatchdayLocked } from "@/lib/ultima/matchday-state";

/**
 * A starting-XV slot is frozen while its league is LOCKED or LIVE.
 * Pass the league's matchday state from getLeagueMatchdayState /
 * computeLeagueMatchdayState. Pure: no gameweek-state fallback.
 *
 * @param {string|null|undefined} leagueState UPCOMING | LOCKED | LIVE | DONE
 */
export function xvSlotLocked(leagueState) {
  return isMatchdayLocked(leagueState);
}
