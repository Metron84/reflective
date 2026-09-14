/** @typedef {"england" | "italy" | "france" | "spain" | "germany"} CrestCountry */

/** @type {{ id: CrestCountry; label: string }[]} */
export const CREST_COUNTRIES = [
  { id: "england", label: "England" },
  { id: "italy", label: "Italy" },
  { id: "france", label: "France" },
  { id: "spain", label: "Spain" },
  { id: "germany", label: "Germany" },
];

/** @type {Record<string, CrestCountry>} */
const BY_COMPETITION = {
  "Premier League": "england",
  "EFL Championship": "england",
  "EFL League One": "england",
  "Serie A": "italy",
  "Serie B": "italy",
  "Ligue 1": "france",
  "Ligue 2": "france",
  LaLiga: "spain",
  "LaLiga 2": "spain",
  Bundesliga: "germany",
  "2. Bundesliga": "germany",
};

/** @type {Record<string, CrestCountry>} */
const BY_SLUG = {
  arsenal: "england",
  everton: "england",
  liverpool: "england",
  "manchester-city": "england",
  "manchester-united": "england",
  "newcastle-united": "england",
  "tottenham-hotspur": "england",
  juventus: "italy",
  napoli: "italy",
  roma: "italy",
  marseille: "france",
  "real-madrid": "spain",
  barcelona: "spain",
  "atletico-madrid": "spain",
  "athletic-bilbao": "spain",
  "bayern-munich": "germany",
  "borussia-dortmund": "germany",
  "st-pauli": "germany",
};

/**
 * @param {{ slug?: string; competition?: string | null }} club
 * @returns {CrestCountry | null}
 */
export function countryForClub(club) {
  if (club?.slug && BY_SLUG[club.slug]) return BY_SLUG[club.slug];
  const comp = club?.competition?.trim();
  if (comp && BY_COMPETITION[comp]) return BY_COMPETITION[comp];
  return null;
}
