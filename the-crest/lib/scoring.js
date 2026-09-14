import {
  CHARACTER_GROUP_WEIGHT,
  CHARACTER_KEYS,
  hasCharacterAnswers,
  resolveClubCharacter,
} from "./club-character.js";
import { DIMS } from "./quiz-content.js";
import {
  applyDiscordance,
  PILLAR_FIT_FLOOR,
  vetoCount,
} from "./survival.js";

const CONFIDENCE_FACTOR = { 3: 1.0, 2: 0.8, 1: 0.6 };

/** @param {number} level */
export function confidenceFactor(level) {
  if (level == null) return 1.0;
  return CONFIDENCE_FACTOR[level] ?? 1.0;
}

/**
 * Per-dimension spread across the full club set, mean-normalised to 1.
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
 * @param {number[]} userVector
 * @param {{ vector: number[]; confidence: number[] }} club
 * @param {{ Heart: number; Mind: number; Soul: number }} pillarWeights
 * @param {number[]} [dimWeights]
 */
export function rawFit(userVector, club, pillarWeights, dimWeights) {
  if (!dimWeights) throw new Error("dimWeights is required");
  const vw = dimWeights;
  let num = 0;
  let den = 0;
  for (let d = 0; d < 12; d++) {
    const sim = 1 - Math.abs(userVector[d] - club.vector[d]) / 6;
    const w = weightFor(d, pillarWeights, club.confidence, vw);
    num += w * sim;
    den += w;
  }
  return den > 0 ? num / den : 0;
}

/**
 * @param {number[]} userVector
 * @param {{ slug: string; vector: number[]; confidence: number[] }[]} clubs
 * @param {{ Heart: number; Mind: number; Soul: number }} pillarWeights
 * @param {number[]} [dimWeights]
 */
export function rank(userVector, clubs, pillarWeights, dimWeights, personCharacter = null) {
  const vw = dimWeights ?? getDimensionWeights(clubs);
  return clubs
    .map((club) => ({
      club,
      raw: pathFit(userVector, club, pillarWeights, vw, personCharacter),
      vetoCount: vetoCount(userVector, club, personCharacter),
    }))
    .sort(comparePathEntries);
}

/**
 * Rank using only answered affinity dimensions (null = skip).
 * @param {(number|null)[]} scores
 */
export function rawFitPartial(scores, club, pillarWeights, dimWeights) {
  if (!dimWeights) throw new Error("dimWeights is required");
  const vw = dimWeights;
  let num = 0;
  let den = 0;
  for (let d = 0; d < 12; d++) {
    if (scores[d] == null) continue;
    const sim = 1 - Math.abs(scores[d] - club.vector[d]) / 6;
    const w = weightFor(d, pillarWeights, club.confidence, vw);
    num += w * sim;
    den += w;
  }
  return den > 0 ? num / den : 0;
}

/**
 * @param {(number|null)[]} scores
 */
export function rankPartial(scores, clubs, pillarWeights, dimWeights, personCharacter = null) {
  const vw = dimWeights ?? getDimensionWeights(clubs);
  return clubs
    .map((club) => ({
      club,
      raw: pathFitPartial(scores, club, pillarWeights, vw, personCharacter),
      vetoCount: vetoCount(scores, club, personCharacter),
    }))
    .sort(comparePathEntries);
}

/**
 * @param {{ vetoCount?: number; raw: number; club: { slug: string } }} a
 * @param {{ vetoCount?: number; raw: number; club: { slug: string } }} b
 */
export function comparePathEntries(a, b) {
  const va = a.vetoCount ?? 0;
  const vb = b.vetoCount ?? 0;
  if (va !== vb) return va - vb;
  if (b.raw !== a.raw) return b.raw - a.raw;
  return a.club.slug.localeCompare(b.club.slug);
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
    const sim = 1 - Math.abs(scores[d] - club.vector[d]) / 6;
    const w = dimWeights[d] * confidenceFactor(club.confidence?.[d]);
    num += w * sim;
    den += w;
  }
  return den > 0 ? num / den : null;
}

/**
 * Hierarchical geometric fit, then conf-2 discordance.
 * @param {number[]} userVector
 * @param {{ vector: number[]; confidence?: number[] }} club
 * @param {{ Heart: number; Mind: number; Soul: number }} pillarWeights
 * @param {number[]} dimWeights
 */
export function pathFit(userVector, club, pillarWeights, dimWeights, personCharacter = null) {
  return pathFitPartial(userVector, club, pillarWeights, dimWeights, personCharacter);
}

/**
 * @param {(number|null)[]} scores
 * @param {{ vector: number[]; confidence?: number[] }} club
 * @param {{ Heart: number; Mind: number; Soul: number }} pillarWeights
 * @param {number[]} dimWeights
 */
export function pathFitPartial(scores, club, pillarWeights, dimWeights, personCharacter = null) {
  if (!dimWeights) throw new Error("dimWeights is required");
  /** @type {("Heart"|"Mind"|"Soul"|"Character")[]} */
  const pillars = ["Heart", "Mind", "Soul"];
  /** @type {Partial<Record<"Heart"|"Mind"|"Soul"|"Character", number>>} */
  const groups = {};
  /** @type {Record<string, number>} */
  const shares = {
    Heart: pillarWeights.Heart,
    Mind: pillarWeights.Mind,
    Soul: pillarWeights.Soul,
  };
  for (const pillar of pillars) {
    const g = pillarGroupFit(scores, club, pillar, dimWeights);
    if (g != null) groups[pillar] = g;
  }
  if (hasCharacterAnswers(personCharacter)) {
    const g = characterGroupFit(personCharacter, club);
    if (g != null) {
      groups.Character = g;
      shares.Character = CHARACTER_GROUP_WEIGHT;
    }
  }
  const available = [...pillars, "Character"].filter((k) => groups[k] != null);
  if (!available.length) return 0;

  let shareSum = 0;
  for (const k of available) shareSum += shares[k] ?? 0;
  if (shareSum <= 0) return 0;

  let fit;
  if (available.length === 1) {
    fit = /** @type {number} */ (groups[available[0]]);
  } else {
    let log = 0;
    for (const k of available) {
      const share = (shares[k] ?? 0) / shareSum;
      const g = Math.max(/** @type {number} */ (groups[k]), PILLAR_FIT_FLOOR);
      log += share * Math.log(g);
    }
    fit = Math.exp(log);
  }

  return applyDiscordance(fit, scores, club, personCharacter);
}

/**
 * @param {{ integrity?: number|null; decency?: number|null; respect?: number|null; power?: number|null }} person
 * @param {object} club
 */
export function characterGroupFit(person, club) {
  const clubChar = resolveClubCharacter(club);
  let num = 0;
  let den = 0;
  for (const key of CHARACTER_KEYS) {
    const value = person[key];
    if (value == null) continue;
    const sim = 1 - Math.abs(value - clubChar.values[key]) / 6;
    const w = confidenceFactor(clubChar.confidence[key]);
    num += w * sim;
    den += w;
  }
  return den > 0 ? num / den : null;
}

/**
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
    (acc, d) => acc + (1 - Math.abs(userVector[d] - club.vector[d]) / 6),
    0,
  );
  return sum / indices.length;
}
