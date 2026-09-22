import { ULTIMA_DEFAULT_RATING_THRESHOLDS } from "./constants.js";
import { ratingPoints } from "./scoring.js";

function seedMetrics(player) {
  return player?.seed_metrics ?? player ?? {};
}

function leagueThresholds(player) {
  const league = player?.league ?? "pl";
  return ULTIMA_DEFAULT_RATING_THRESHOLDS[league] ?? ULTIMA_DEFAULT_RATING_THRESHOLDS.pl;
}

function clamp01(value, fallback = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

/**
 * Expected Ultima points from stored seed rates (per 90) and the live rating bands.
 * Minutes reliability scales playing time. Missing reliability does not zero the score.
 */
export function expectedUltimaPoints(player) {
  const m = seedMetrics(player);
  const raw =
    Number(m.goals_rate ?? 0) * 3 +
    Number(m.assists_rate ?? 0) +
    ratingPoints(m.rating_avg, leagueThresholds(player));
  const minutes = m.minutes_reliability;
  if (minutes == null || minutes === "") return raw;
  return raw * clamp01(minutes, 1);
}
