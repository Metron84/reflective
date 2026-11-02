/**
 * Crest competitions. Display order for the result-screen league rows.
 * A club belongs to at most one competition, stamped from the 2026-27 lists
 * in scripts/crest/league-lists/.
 *
 * Playable set: the five top flights, then Rest of the World. Second
 * rungs (Championship, League One, LaLiga 2, Serie B, 2. Bundesliga,
 * Ligue 2) are out of the match.
 */

export const CREST_COMPETITIONS = [
  "Premier League",
  "LaLiga",
  "Serie A",
  "Bundesliga",
  "Ligue 1",
  "Eredivisie",
  "Scottish Premiership",
  "Super League Greece",
  "HNL",
  "Czech First League",
  "Süper Lig",
];

export const CREST_COMPETITION_LABEL = Object.fromEntries(
  CREST_COMPETITIONS.map((name) => [name, name]),
);

/** Rest of the World clubs: one top flight per country, from the live roster. */
export const COUNTRY_COMPETITION = {
  Netherlands: "Eredivisie",
  Scotland: "Scottish Premiership",
  Greece: "Super League Greece",
  Croatia: "HNL",
  Czechia: "Czech First League",
  Turkey: "Süper Lig",
};
