import { countryForClub, CREST_COUNTRIES } from "./club-country.js";
import { KIT_FAMILIES } from "./quiz-content.js";

export const COLOR_RANK_COUNT = 3;
/** Third-ranked kit only hurts fit. It never removes a club. */
export const COLOR3_PENALTY = 0.88;

/**
 * @param {unknown} input
 * @returns {string[]}
 */
export function normalizeHatedColors(input) {
  const list = Array.isArray(input) ? input : input ? [input] : [];
  /** @type {string[]} */
  const out = [];
  for (const color of list) {
    if (typeof color !== "string") continue;
    if (!KIT_FAMILIES.includes(color) || out.includes(color)) continue;
    out.push(color);
    if (out.length === COLOR_RANK_COUNT) break;
  }
  return out;
}

/**
 * Keep the second-ranked kit in a country only when dropping it would empty that country.
 * @param {string} countryId
 * @param {object[]} clubs
 * @param {string[]} colors
 */
export function countryNeedsColor2(countryId, clubs, colors) {
  if (!colors[1] || !countryId) return false;
  const inCountry = clubs.filter((c) => countryForClub(c) === countryId);
  const afterFirst = inCountry.filter((c) => c.kit_family !== colors[0]);
  const afterSecond = afterFirst.filter((c) => c.kit_family !== colors[1]);
  return afterSecond.length === 0 && afterFirst.some((c) => c.kit_family === colors[1]);
}

/**
 * @param {object[]} clubs
 * @param {unknown} hatedColors
 * @returns {{ pool: object[]; color2Kept: Set<string>; colors: string[] }}
 */
export function filterByColours(clubs, hatedColors) {
  const colors = normalizeHatedColors(hatedColors);
  if (!colors.length) {
    return { pool: clubs, color2Kept: new Set(), colors };
  }

  const color2Kept = new Set();
  if (colors[1]) {
    for (const country of CREST_COUNTRIES) {
      if (!countryNeedsColor2(country.id, clubs, colors)) continue;
      for (const club of clubs) {
        if (
          countryForClub(club) === country.id &&
          club.kit_family === colors[1]
        ) {
          color2Kept.add(club.slug);
        }
      }
    }
  }

  const pool = clubs.filter((club) => {
    if (club.kit_family === colors[0]) return false;
    if (colors[1] && club.kit_family === colors[1]) {
      return color2Kept.has(club.slug);
    }
    return true;
  });

  return { pool, color2Kept, colors };
}

/**
 * @param {{ kit_family?: string }} club
 * @param {string[]} colors
 */
export function isColor3Club(club, colors) {
  return Boolean(colors[2] && club.kit_family === colors[2]);
}
