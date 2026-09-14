import { pillarGroupFit } from "./scoring.js";
import { sensesScore } from "./senses.js";

export const FIT_WEIGHTS = {
  Heart: 0.3,
  Mind: 0.2,
  Soul: 0.3,
  Senses: 0.2,
};

/**
 * @param {number} pct
 * @returns {0 | 1 | 2 | 3}
 */
export function strengthTierIndex(pct) {
  if (pct >= 85) return 3;
  if (pct >= 70) return 2;
  if (pct >= 55) return 1;
  return 0;
}

/**
 * @param {number} pct
 */
export function strengthTierLine(pct) {
  if (pct >= 85) return "This is your club.";
  if (pct >= 70) return "A strong match.";
  if (pct >= 55) {
    return "The closest match on this map, not the closest to you.";
  }
  return "No real match here. Your club lives on another map.";
}

/**
 * @param {number} index
 * @param {'low' | 'high'} edge
 */
function tierBoundary(index, edge) {
  if (index <= 0) return edge === "low" ? 0 : 54;
  if (index === 1) return edge === "low" ? 55 : 69;
  if (index === 2) return edge === "low" ? 70 : 84;
  return edge === "low" ? 85 : 100;
}

/**
 * Senses may move a club one strength tier, never more.
 * @param {number} basePct  Heart/Mind/Soul only, 0–80 scale in the full formula
 * @param {number} uncappedPct  with senses
 */
export function capSensesPercent(basePct, uncappedPct) {
  const baseTier = strengthTierIndex(basePct);
  const nextTier = strengthTierIndex(uncappedPct);
  if (Math.abs(nextTier - baseTier) <= 1) return uncappedPct;
  const allowed = baseTier + Math.sign(nextTier - baseTier);
  if (uncappedPct > basePct) return tierBoundary(allowed, "high");
  return tierBoundary(allowed, "low");
}

/**
 * @param {number} fit 0–1
 */
export function fitPercent(fit) {
  return Math.max(0, Math.min(100, Math.round(fit * 100)));
}

/**
 * @param {(number|null)[]} scores
 * @param {object} club
 * @param {number[]} dimWeights
 * @param {(number|null)[]|null} [sensesAnswers]
 * @returns {{ fit: number; percent: number; heart: number|null; mind: number|null; soul: number|null; senses: number|null }}
 */
export function compositionFit(scores, club, dimWeights, sensesAnswers = null) {
  const heart = pillarGroupFit(scores, club, "Heart", dimWeights);
  const mind = pillarGroupFit(scores, club, "Mind", dimWeights);
  const soul = pillarGroupFit(scores, club, "Soul", dimWeights);
  const sensesPct = sensesScore(sensesAnswers ?? []);
  const senses01 = sensesPct == null ? null : sensesPct / 100;

  let base = 0;
  if (heart != null) base += FIT_WEIGHTS.Heart * heart;
  if (mind != null) base += FIT_WEIGHTS.Mind * mind;
  if (soul != null) base += FIT_WEIGHTS.Soul * soul;

  const basePct = fitPercent(base);
  if (senses01 == null) {
    return { fit: base, percent: basePct, heart, mind, soul, senses: sensesPct };
  }

  const uncapped = base + FIT_WEIGHTS.Senses * senses01;
  const cappedPct = capSensesPercent(basePct, fitPercent(uncapped));
  return {
    fit: cappedPct / 100,
    percent: cappedPct,
    heart,
    mind,
    soul,
    senses: sensesPct,
  };
}
