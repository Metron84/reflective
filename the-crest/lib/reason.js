import { DIMS } from "./quiz-content.js";
import { weightFor } from "./scoring.js";

/**
 * Two dimensions with the smallest weighted gap, as the pole the club sits on.
 * @param {number[]} userVector
 * @param {{ vector: number[]; confidence: number[] }} club
 * @param {{ Heart: number; Mind: number; Soul: number }} pillarWeights
 * @param {number[]} dimWeights
 */
export function reasonFor(userVector, club, pillarWeights, dimWeights) {
  const gaps = DIMS.map((dim, i) => {
    const gap =
      Math.abs(userVector[i] - club.vector[i]) *
      weightFor(i, pillarWeights, club.confidence, dimWeights);
    return { dim, i, gap };
  })
    .sort((a, b) => a.gap - b.gap)
    .slice(0, 2);

  return gaps
    .map(({ dim, i }) => {
      const val = club.vector[i];
      if (val >= 5) return dim.high.toLowerCase();
      if (val <= 3) return dim.low.toLowerCase();
      return "balance";
    })
    .join(" and ");
}

/**
 * @param {number[]} userVector
 * @param {{ vector: number[] }} club
 */
export function pillarReasonBlocks(userVector, club) {
  return /** @type {const} */ (["Heart", "Mind", "Soul"]).map((pillar) => {
    const indices = DIMS.map((d, i) => (d.pillar === pillar ? i : -1)).filter(
      (i) => i >= 0,
    );
    let best = indices[0];
    let bestGap = Infinity;
    for (const i of indices) {
      const gap = Math.abs((userVector[i] ?? 4) - club.vector[i]);
      if (gap < bestGap) {
        bestGap = gap;
        best = i;
      }
    }
    const dim = DIMS[best];
    const val = club.vector[best];
    const pole =
      val >= 5 ? dim.high : val <= 3 ? dim.low : "a balance of both";
    return { pillar, line: `${dim.id}: ${pole}.` };
  });
}
