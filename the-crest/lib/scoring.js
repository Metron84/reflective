/**
 * The Crest matching maths (panel lock).
 * Flat weighted mean only. No hierarchical fit, discordance, or character terms.
 */
import { DIMS } from "./quiz-content.js";

const CONFIDENCE_FACTOR = { 3: 1.0, 2: 0.8, 1: 0.6 };

/** @param {number} level */
export function confidenceFactor(level) {
  if (level == null) return 1.0;
  return CONFIDENCE_FACTOR[level] ?? 1.0;
}

/**
 * Per-dimension spread across the full club set, mean-normalised to 1.
 * Near-zero variance stays silent. Do not boost manually.
 * @param {{ vector: number[] }[]} clubs
 * @returns {number[]}
 */
export function dimensionWeights(clubs) {
  if (!clubs?.length) return Array(12).fill(1);
  const weights = DIMS.map((_, d) => {
    const col = clubs.map((c) => c.vector[d]);
    const mean = col.reduce((a, b) => a + b, 0) / col.length;
    const meanSq =
      col.reduce((a, b) => a + (b - mean) ** 2, 0) / col.length;
    return Math.sqrt(meanSq);
  });
  const mean = weights.reduce((a, b) => a + b, 0) / weights.length;
  return weights.map((x) => (mean > 0 ? x / mean : 1));
}

let cachedDimensionWeights = null;

/** Weights for the committed club set, computed once per load from the full list. */
export function getDimensionWeights(clubs) {
  if (!clubs?.length) return Array(12).fill(1);
  if (!cachedDimensionWeights) {
    cachedDimensionWeights = dimensionWeights(clubs);
  }
  return cachedDimensionWeights;
}

export function resetDimensionCache() {
  cachedDimensionWeights = null;
}

/**
 * Alias kept for Section 4 naming.
 * @param {{ vector: number[] }[]} clubs
 */
export function varianceWeights(clubs) {
  return dimensionWeights(clubs);
}

/**
 * @param {number} dimensionIndex
 * @param {{ Heart: number; Mind: number; Soul: number }} pillarWeights
 * @param {number[]} clubConfidence
 * @param {number[]} dimWeights
 */
export function weightFor(
  dimensionIndex,
  pillarWeights,
  clubConfidence,
  dimWeights,
) {
  const pillar = DIMS[dimensionIndex].pillar;
  const pillarShare = pillarWeights[pillar] / 4;
  const conf = confidenceFactor(clubConfidence?.[dimensionIndex]);
  return pillarShare * dimWeights[dimensionIndex] * conf;
}

/**
 * Absolute-difference similarity on the 1–7 scale.
 * @param {number} user
 * @param {number} club
 */
export function similarity(user, club) {
  return 1 - Math.abs(user - club) / 6;
}

/**
 * @param {number[]} userVector
 * @param {{ vector: number[]; confidence: number[] }} club
 * @param {{ Heart: number; Mind: number; Soul: number }} pillarWeights
 * @param {number[]} dimWeights
 */
export function rawFit(userVector, club, pillarWeights, dimWeights) {
  if (!dimWeights) throw new Error("dimWeights is required");
  let num = 0;
  let den = 0;
  for (let d = 0; d < 12; d++) {
    const sim = similarity(userVector[d], club.vector[d]);
    const w = weightFor(d, pillarWeights, club.confidence, dimWeights);
    num += w * sim;
    den += w;
  }
  return den > 0 ? num / den : 0;
}

/**
 * Rank using only answered affinity dimensions (null = skip).
 * @param {(number|null)[]} scores
 * @param {{ vector: number[]; confidence: number[] }} club
 * @param {{ Heart: number; Mind: number; Soul: number }} pillarWeights
 * @param {number[]} dimWeights
 */
export function rawFitPartial(scores, club, pillarWeights, dimWeights) {
  if (!dimWeights) throw new Error("dimWeights is required");
  let num = 0;
  let den = 0;
  for (let d = 0; d < 12; d++) {
    if (scores[d] == null) continue;
    const sim = similarity(scores[d], club.vector[d]);
    const w = weightFor(d, pillarWeights, club.confidence, dimWeights);
    num += w * sim;
    den += w;
  }
  return den > 0 ? num / den : 0;
}

/**
 * @param {{ raw: number; club: { slug: string } }} a
 * @param {{ raw: number; club: { slug: string } }} b
 */
export function compareRankEntries(a, b) {
  if (b.raw !== a.raw) return b.raw - a.raw;
  return a.club.slug.localeCompare(b.club.slug);
}

/** @deprecated Use compareRankEntries. Kept for call-site compatibility. */
export const comparePathEntries = compareRankEntries;

/**
 * @param {number[]} userVector
 * @param {{ slug: string; vector: number[]; confidence: number[] }[]} clubs
 * @param {{ Heart: number; Mind: number; Soul: number }} pillarWeights
 * @param {number[]} [dimWeights]
 */
export function rank(userVector, clubs, pillarWeights, dimWeights) {
  const vw = dimWeights ?? getDimensionWeights(clubs);
  return clubs
    .map((club) => ({
      club,
      raw: rawFit(userVector, club, pillarWeights, vw),
    }))
    .sort(compareRankEntries);
}

/**
 * @param {(number|null)[]} scores
 * @param {{ slug: string; vector: number[]; confidence: number[] }[]} clubs
 * @param {{ Heart: number; Mind: number; Soul: number }} pillarWeights
 * @param {number[]} [dimWeights]
 */
export function rankPartial(scores, clubs, pillarWeights, dimWeights) {
  const vw = dimWeights ?? getDimensionWeights(clubs);
  return clubs
    .map((club) => ({
      club,
      raw: rawFitPartial(scores, club, pillarWeights, vw),
    }))
    .sort(compareRankEntries);
}

/**
 * Weighted mean inside one pillar from answered dims only.
 * @param {(number|null)[]} scores
 * @param {{ vector: number[]; confidence?: number[] }} club
 * @param {"Heart"|"Mind"|"Soul"} pillar
 * @param {number[]} dimWeights
 */
export function pillarGroupFit(scores, club, pillar, dimWeights) {
  let num = 0;
  let den = 0;
  for (let d = 0; d < 12; d++) {
    if (scores[d] == null) continue;
    if (DIMS[d].pillar !== pillar) continue;
    const sim = similarity(scores[d], club.vector[d]);
    const w = dimWeights[d] * confidenceFactor(club.confidence?.[d]);
    num += w * sim;
    den += w;
  }
  return den > 0 ? num / den : null;
}

/**
 * User-relative display percentage. Floor 60. Never show raw fit.
 * @param {number} raw
 * @param {number} lowest
 * @param {number} highest
 */
export function displayPercent(raw, lowest, highest) {
  if (highest === lowest) return 80;
  const scaled = 60 + ((raw - lowest) / (highest - lowest)) * 37;
  return Math.max(60, Math.round(scaled));
}

/**
 * Unweighted mean similarity inside one pillar (full vector).
 * @param {number[]} userVector
 * @param {{ vector: number[] }} club
 * @param {"Heart"|"Mind"|"Soul"} pillar
 */
export function pillarFit(userVector, club, pillar) {
  const indices = DIMS.map((d, i) => (d.pillar === pillar ? i : -1)).filter(
    (i) => i >= 0,
  );
  if (!indices.length) return 0;
  const sum = indices.reduce(
    (acc, d) => acc + similarity(userVector[d], club.vector[d]),
    0,
  );
  return sum / indices.length;
}

/**
 * True when every score sits near the codebook neutral (4).
 * @param {number[]} userVector
 * @param {number} [maxDrift=1]
 */
export function isNearNeutral(userVector, maxDrift = 1) {
  if (!userVector?.length) return false;
  return userVector.every((s) => Math.abs(s - 4) <= maxDrift);
}
