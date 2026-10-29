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

/**
 * Result list. Five countries, then one Rest of the World heading.
 * A club is filed by the league it plays in. Wales stays in England.
 * Monaco stays in France. Czechia and Czech Republic share one league row.
 *
 * @type {{country: string, leagues: {competition: string, label: string}[]}[]}
 */
export const RESULT_COUNTRIES = [
  {
    country: "England",
    leagues: [
      { competition: "Premier League", label: "Premier League" },
      { competition: "Championship", label: "Championship" },
      { competition: "League One", label: "League One" },
    ],
  },
  {
    country: "Spain",
    leagues: [
      { competition: "LaLiga", label: "LaLiga" },
      { competition: "LaLiga 2", label: "LaLiga 2" },
    ],
  },
  {
    country: "Italy",
    leagues: [
      { competition: "Serie A", label: "Serie A" },
      { competition: "Serie B", label: "Serie B" },
    ],
  },
  {
    country: "Germany",
    leagues: [
      { competition: "Bundesliga", label: "Bundesliga" },
      { competition: "2. Bundesliga", label: "2. Bundesliga" },
    ],
  },
  {
    country: "France",
    leagues: [
      { competition: "Ligue 1", label: "Ligue 1" },
      { competition: "Ligue 2", label: "Ligue 2" },
    ],
  },
  {
    country: "Rest of the World",
    leagues: [
      { competition: "Eredivisie", label: "Eredivisie" },
      { competition: "Scottish Premiership", label: "Scottish Premiership" },
      { competition: "Super League Greece", label: "Super League Greece" },
      { competition: "HNL", label: "HNL" },
      { competition: "Czech First League", label: "Czech First League" },
      { competition: "Süper Lig", label: "Süper Lig" },
      { competition: "Primeira Liga", label: "Primeira Liga" },
      { competition: "Belgian Pro League", label: "Belgian Pro League" },
      { competition: "Austrian Bundesliga", label: "Austrian Bundesliga" },
      { competition: "Danish Superliga", label: "Danish Superliga" },
      { competition: "Swiss Super League", label: "Swiss Super League" },
      { competition: "Serbian SuperLiga", label: "Serbian SuperLiga" },
      { competition: "UAE Pro League", label: "UAE Pro League" },
      { competition: "Saudi Pro League", label: "Saudi Pro League" },
      { competition: "Egyptian Premier League", label: "Egyptian Premier League" },
      { competition: "Tunisian Ligue Professionnelle 1", label: "Tunisian Ligue Professionnelle 1" },
    ],
  },
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
