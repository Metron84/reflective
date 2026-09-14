import { countryForClub } from "./club-country.js";

/** @typedef {'all' | 'ENG' | 'ESP' | 'ITA' | 'GER' | 'FRA'} LeagueScope */

/** @type {{ id: LeagueScope; label: string }[]} */
export const SCOPE_OPTIONS = [
  { id: "all", label: "Anywhere" },
  { id: "ENG", label: "England" },
  { id: "ESP", label: "Spain" },
  { id: "ITA", label: "Italy" },
  { id: "GER", label: "Germany" },
  { id: "FRA", label: "France" },
];

/** @type {Record<Exclude<LeagueScope, 'all'>, import("./club-country.js").CrestCountry>} */
export const SCOPE_COUNTRY = {
  ENG: "england",
  ESP: "spain",
  ITA: "italy",
  GER: "germany",
  FRA: "france",
};

/** Horizon tints when a country is chosen before a leader exists. */
export const SCOPE_PALETTE = {
  ENG: { primary: "200, 16, 46", secondary: "242, 237, 228" },
  ESP: { primary: "198, 12, 48", secondary: "255, 196, 0" },
  ITA: { primary: "0, 82, 165", secondary: "242, 237, 228" },
  GER: { primary: "0, 0, 0", secondary: "221, 0, 0" },
  FRA: { primary: "0, 35, 149", secondary: "237, 41, 57" },
};

/**
 * @param {unknown} value
 * @returns {LeagueScope}
 */
export function normalizeLeagueScope(value) {
  if (value === "ENG" || value === "ESP" || value === "ITA" || value === "GER" || value === "FRA") {
    return value;
  }
  return "all";
}

/**
 * @param {LeagueScope} scope
 * @param {object[]} clubs
 */
export function clubsForScope(clubs, scope) {
  if (!clubs?.length) return [];
  if (scope === "all") return clubs;
  const country = SCOPE_COUNTRY[scope];
  if (!country) return clubs;
  return clubs.filter((club) => countryForClub(club) === country);
}

/**
 * @param {LeagueScope} used
 */
export const REMAP_COUNTRIES = SCOPE_OPTIONS.filter((o) => o.id !== "all");

/**
 * @param {LeagueScope} used
 */
export function remapTargets(used) {
  if (used === "all") return REMAP_COUNTRIES;
  return REMAP_COUNTRIES.filter((o) => o.id !== used);
}
