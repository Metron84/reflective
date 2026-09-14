/**
 * Owned-club picker: league order and grouping for clubs.json.
 */

/** @type {{ id: string; label: string }[]} */
export const OWNED_PICKER_LEAGUES = [
  { id: "premier-league", label: "Premier League" },
  { id: "laliga", label: "LaLiga" },
  { id: "serie-a", label: "Serie A" },
  { id: "bundesliga", label: "Bundesliga" },
  { id: "ligue-1", label: "Ligue 1" },
  { id: "other-well-known", label: "Other well-known clubs" },
  { id: "laliga-2", label: "LaLiga 2" },
  { id: "serie-b", label: "Serie B" },
  { id: "2-bundesliga", label: "2. Bundesliga" },
  { id: "ligue-2", label: "Ligue 2" },
  { id: "efl-championship", label: "EFL Championship" },
  { id: "efl-league-one", label: "EFL League One" },
];

/** @type {Record<string, string>} competition label → group id */
const COMPETITION_TO_GROUP = {
  "Premier League": "premier-league",
  LaLiga: "laliga",
  "Serie A": "serie-a",
  Bundesliga: "bundesliga",
  "Ligue 1": "ligue-1",
  "LaLiga 2": "laliga-2",
  "Serie B": "serie-b",
  "2. Bundesliga": "2-bundesliga",
  "Ligue 2": "ligue-2",
  "EFL Championship": "efl-championship",
  "EFL League One": "efl-league-one",
};

/** Tier A clubs without competition on the bundle (slug → group id). */
/** @type {Record<string, string>} */
export const TIER_A_PICKER_GROUP = {
  arsenal: "premier-league",
  everton: "premier-league",
  liverpool: "premier-league",
  "manchester-city": "premier-league",
  "manchester-united": "premier-league",
  "newcastle-united": "premier-league",
  "tottenham-hotspur": "premier-league",
  "real-madrid": "laliga",
  barcelona: "laliga",
  "atletico-madrid": "laliga",
  "athletic-bilbao": "laliga",
  juventus: "serie-a",
  napoli: "serie-a",
  roma: "serie-a",
  "bayern-munich": "bundesliga",
  "borussia-dortmund": "bundesliga",
  "st-pauli": "bundesliga",
  marseille: "ligue-1",
  ajax: "other-well-known",
  celtic: "other-well-known",
  "al-ahly": "other-well-known",
  "al-ain": "other-well-known",
  "al-hilal": "other-well-known",
  "wydad-casablanca": "other-well-known",
};

/**
 * @param {{ slug: string; name: string; competition?: string | null; tier?: string }} club
 * @returns {string}
 */
export function pickerGroupIdForClub(club) {
  const fromTierA = TIER_A_PICKER_GROUP[club.slug];
  if (fromTierA) return fromTierA;
  const comp = club.competition?.trim();
  if (comp && COMPETITION_TO_GROUP[comp]) {
    return COMPETITION_TO_GROUP[comp];
  }
  return "other-well-known";
}

/**
 * @param {object[]} clubs
 * @returns {{ id: string; label: string; clubs: { slug: string; name: string }[] }[]}
 */
export function groupClubsForOwnedPicker(clubs) {
  /** @type {Map<string, { slug: string; name: string }[]>} */
  const buckets = new Map();
  for (const league of OWNED_PICKER_LEAGUES) {
    buckets.set(league.id, []);
  }

  for (const club of clubs) {
    const id = pickerGroupIdForClub(club);
    const bucket = buckets.get(id) ?? buckets.get("other-well-known");
    if (!bucket) continue;
    bucket.push({ slug: club.slug, name: club.name });
  }

  for (const list of buckets.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }

  return OWNED_PICKER_LEAGUES.map((league) => ({
    id: league.id,
    label: league.label,
    clubs: buckets.get(league.id) ?? [],
  })).filter((section) => section.clubs.length > 0);
}
