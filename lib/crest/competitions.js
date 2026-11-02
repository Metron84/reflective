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

/** Big-five leagues on the result screen and in My Programme. */
export const PYRAMID_LEAGUES = [
  { country: "England", competition: "Premier League", label: "Premier League" },
  { country: "Spain", competition: "LaLiga", label: "LaLiga" },
  { country: "Italy", competition: "Serie A", label: "Serie A" },
  { country: "Germany", competition: "Bundesliga", label: "Bundesliga" },
  { country: "France", competition: "Ligue 1", label: "Ligue 1" },
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
    leagues: [{ competition: "Premier League", label: "Premier League" }],
  },
  {
    country: "Spain",
    leagues: [{ competition: "LaLiga", label: "LaLiga" }],
  },
  {
    country: "Italy",
    leagues: [{ competition: "Serie A", label: "Serie A" }],
  },
  {
    country: "Germany",
    leagues: [{ competition: "Bundesliga", label: "Bundesliga" }],
  },
  {
    country: "France",
    leagues: [{ competition: "Ligue 1", label: "Ligue 1" }],
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
