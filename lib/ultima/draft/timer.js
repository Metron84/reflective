import { ULTIMA_PICK_TIMER_TIERS } from "@/lib/ultima/constants";

/** Season drafts run a tiered clock. Practice keeps its own timer. */
export function isTieredTimer(competition) {
  return competition?.kind === "season";
}

/**
 * Seconds on the clock for a pick. Round = ceil(pickNumber / seatCount).
 * @param {number} pickNumber 1-based overall pick
 * @param {number} seatCount seats in the draft order
 */
export function timerForPick(pickNumber, seatCount) {
  const seats = Math.max(1, Number(seatCount) || 1);
  const round = Math.max(1, Math.ceil((Number(pickNumber) || 1) / seats));
  const tier =
    ULTIMA_PICK_TIMER_TIERS.find((t) => round <= t.throughRound) ??
    ULTIMA_PICK_TIMER_TIERS[ULTIMA_PICK_TIMER_TIERS.length - 1];
  return tier.seconds;
}

/** Clock length for a pick: the tier for season, the competition setting otherwise. */
export function pickClockSeconds(competition, pickNumber, seatCount) {
  if (isTieredTimer(competition)) return timerForPick(pickNumber, seatCount);
  return competition?.timer_seconds ?? 60;
}
