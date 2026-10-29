/**
 * Want pools. Every club is filed once from a 50/50 reading of the two voices.
 * Belonging and winning is not a pool. A club that would have landed there
 * stays with its stronger single want.
 */

import { CLUBS } from "./clubs.js";

/** @typedef {'belonging'|'love'|'winning'|'belonging_love'|'love_winning'} CrestPoolId */

const GAP = 0.15;

/**
 * @param {import("./clubs.js").CrestClub} club
 * @param {number} facet
 * @returns {number|null}
 */
function half(club, facet) {
  const hasSelf = club.selfMask ? Boolean(club.selfMask[facet]) : true;
  const hasOthers = club.othersMask ? Boolean(club.othersMask[facet]) : true;
  if (hasSelf && hasOthers) return 0.5 * club.self[facet] + 0.5 * club.others[facet];
  if (hasSelf) return club.self[facet];
  if (hasOthers) return club.others[facet];
  return null;
}

/**
 * @param {import("./clubs.js").CrestClub} club
 * @param {[number, number][]} pairs
 */
function wantScore(club, pairs) {
  const values = [];
  for (const [facet, pole] of pairs) {
    const value = half(club, facet);
    if (value == null) continue;
    values.push(value * pole);
  }
  if (values.length < 2) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * @param {import("./clubs.js").CrestClub} club
 * @returns {CrestPoolId}
 */
export function categoryOfClub(club) {
  const scores = {
    belonging: wantScore(club, [
      [2, -1],
      [3, -1],
    ]),
    love: wantScore(club, [
      [7, 1],
      [4, -1],
      [1, 1],
    ]),
    winning: wantScore(club, [
      [0, -1],
      [11, 1],
    ]),
  };
  const ranked = Object.entries(scores)
    .map(([name, value]) => [name, value == null ? -9 : value])
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const [first, second] = ranked;
  const pairKey = [first[0], second[0]].sort().join("+");
  if (second[1] >= 0 && first[1] - second[1] <= GAP) {
    if (pairKey === "belonging+love") return "belonging_love";
    if (pairKey === "love+winning") return "love_winning";
  }
  return /** @type {CrestPoolId} */ (first[0]);
}

/** @type {Map<string, CrestPoolId>} */
const CATEGORY = new Map(CLUBS.map((club) => [club.slug, categoryOfClub(club)]));

/**
 * @param {string} slug
 * @returns {CrestPoolId|null}
 */
export function categoryOf(slug) {
  return CATEGORY.get(slug) || null;
}

/**
 * @param {string|null|undefined} stakeId
 * @returns {import("./clubs.js").CrestClub[]}
 */
export function clubsForStake(stakeId) {
  if (!stakeId) return CLUBS.slice();
  return CLUBS.filter((club) => CATEGORY.get(club.slug) === stakeId);
}

/**
 * @param {string} slug
 * @param {string|null|undefined} stakeId
 */
export function inPool(slug, stakeId) {
  if (!stakeId) return true;
  return CATEGORY.get(slug) === stakeId;
}
