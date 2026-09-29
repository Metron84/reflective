/**
 * Crest competitions. Display order for the result-screen league rows.
 * A club belongs to at most one competition, stamped from the 2026-27 lists
 * in scripts/crest/league-lists/.
 */

export const CREST_COMPETITIONS = [
  "Premier League",
  "Championship",
  "League One",
  "LaLiga",
  "LaLiga 2",
  "Serie A",
  "Serie B",
  "Bundesliga",
  "2. Bundesliga",
  "Ligue 1",
  "Ligue 2",
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
