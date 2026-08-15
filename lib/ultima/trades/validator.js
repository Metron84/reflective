/**
 * Trade fairness validator (advisory, spec section 12.2).
 * @param {Array<{ ppg: number, fixturesRemaining: number, minutesReliability: number, boltExpectation: number }>} giveSide
 * @param {Array<{ ppg: number, fixturesRemaining: number, minutesReliability: number, boltExpectation: number }>} getSide
 * @param {number} [gameweeksPlayed=3]
 */
export function validateTradeFairness(giveSide, getSide, gameweeksPlayed = 3) {
  const project = (players) =>
    players.reduce(
      (sum, p) =>
        sum +
        p.ppg * p.fixturesRemaining * p.minutesReliability +
        p.boltExpectation,
      0,
    );

  const minGw = Math.min(
    ...giveSide.map(() => gameweeksPlayed),
    ...getSide.map(() => gameweeksPlayed),
  );
  if (minGw < 3) {
    return {
      verdict: "not_enough_data",
      label: "Not enough data",
      message: "Not enough data yet. Trades open at gameweek 4.",
      gapPercent: null,
    };
  }

  const giveTotal = project(giveSide);
  const getTotal = project(getSide);
  const avg = (giveTotal + getTotal) / 2 || 1;
  const gapPercent = Math.abs(giveTotal - getTotal) / avg;

  let verdict;
  let label;
  let favoured = giveTotal > getTotal ? "proposer" : "receiver";

  if (gapPercent <= 0.1) {
    verdict = "even";
    label = "Even trade";
    favoured = null;
  } else if (gapPercent <= 0.25) {
    verdict = "slight_edge";
    label = `Slight edge to ${favoured === "proposer" ? "you" : "them"}`;
  } else {
    verdict = "lopsided";
    label = `Lopsided, favours ${favoured === "proposer" ? "you" : "them"}`;
  }

  const pct = Math.round(gapPercent * 100);
  const message =
    verdict === "even"
      ? `Even trade. Within ${pct}%.`
      : `${label}. Gap ${pct}%.`;

  return { verdict, label, message, gapPercent, giveTotal, getTotal };
}
