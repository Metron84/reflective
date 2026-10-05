/**
 * A starting-XV slot is locked from its league's open time. A live gameweek
 * with no open time for the league counts as locked too, the same rule the
 * trade settlement uses. Pure: pass `now` in tests.
 */
export function xvSlotLocked(gameweek, league, now = Date.now()) {
  if (!gameweek) return false;
  const openAt = gameweek.league_open_at?.[league];
  if (openAt) {
    const t = new Date(openAt).getTime();
    return Number.isFinite(t) && now >= t;
  }
  return gameweek.state === "live";
}
