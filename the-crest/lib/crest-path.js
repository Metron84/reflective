/**
 * Panel geometry for the twelve-spoke crest.
 * ViewBox 280×280. Centre (140, 140). Linear radius only.
 */

export const CREST_CX = 140;
export const CREST_CY = 140;
export const CREST_R_MIN = 26;
export const CREST_R_NEUTRAL = 72;
export const CREST_R_MAX = 118;

/**
 * @param {number} score 1–7
 */
export function radiusForScore(score) {
  const s = Number.isFinite(score) ? score : 4;
  return CREST_R_MIN + ((s - 1) / 6) * (CREST_R_MAX - CREST_R_MIN);
}

/**
 * @param {number} index 0–11
 * @param {number} r
 * @returns {[number, number]}
 */
export function spokePoint(index, r) {
  const ang = (Math.PI * 2 * index) / 12 - Math.PI / 2;
  return [
    CREST_CX + Math.cos(ang) * r,
    CREST_CY + Math.sin(ang) * r,
  ];
}

/**
 * Tip points for twelve scores (H1 at 12 o'clock, clockwise).
 * @param {number[]} scores length 12
 * @returns {[number, number][]}
 */
export function crestSpokeTips(scores) {
  const list = scores?.length === 12 ? scores : Array(12).fill(4);
  return list.map((s, i) => spokePoint(i, radiusForScore(s)));
}

/**
 * Closed polygon path (legacy helpers / tests). The live crest draws spokes only.
 * @param {number[]} scores length 12
 */
export function crestPathD(scores) {
  const pts = crestSpokeTips(scores);
  return (
    pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ") +
    " Z"
  );
}
