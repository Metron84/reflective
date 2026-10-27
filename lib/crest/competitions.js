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
  "Primeira Liga",
  "Belgian Pro League",
  "Austrian Bundesliga",
  "Danish Superliga",
  "Swiss Super League",
  "Serbian SuperLiga",
  "UAE Pro League",
  "Saudi Pro League",
  "Egyptian Premier League",
  "Tunisian Ligue Professionnelle 1",
];

export const CREST_COMPETITION_LABEL = Object.fromEntries(
  CREST_COMPETITIONS.map((name) => [name, name]),
);

/** Big-five leagues on the result screen and in My Programme. */
export const PYRAMID_LEAGUES = [
  { country: "England", competition: "Premier League", label: "Premier League" },
  { country: "England", competition: "Championship", label: "Championship" },
  { country: "England", competition: "League One", label: "League 1" },
  { country: "England", competition: "League Two", label: "League 2" },
  { country: "France", competition: "Ligue 1", label: "Ligue 1" },
  { country: "France", competition: "Ligue 2", label: "Ligue 2" },
  { country: "Germany", competition: "Bundesliga", label: "Bundesliga" },
  { country: "Germany", competition: "2. Bundesliga", label: "Bundesliga 2" },
  { country: "Italy", competition: "Serie A", label: "Serie A" },
  { country: "Italy", competition: "Serie B", label: "Serie B" },
  { country: "Spain", competition: "LaLiga", label: "LaLiga" },
  { country: "Spain", competition: "LaLiga 2", label: "LaLiga 2" },
];

/** Rest of the World clubs: one top flight per country, from the live roster. */
export const COUNTRY_COMPETITION = {
  Netherlands: "Eredivisie",
  Scotland: "Scottish Premiership",
  Greece: "Super League Greece",
  Croatia: "HNL",
  Czechia: "Czech First League",
  Turkey: "Süper Lig",
};
