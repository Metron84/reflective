import { ULTIMA_LEAGUES, ULTIMA_LEAGUE_SHORT } from "../constants.js";

/** Country chips on the league block: All, then ENG ESP ITA GER FRA. */
export const BLOCK_CHIPS = [
  { id: "all", label: "All", league: null },
  ...ULTIMA_LEAGUES.map((league) => ({ id: league, label: ULTIMA_LEAGUE_SHORT[league], league })),
];

const at = (value) => {
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
};

/** Keep only players from one league. "all" keeps everyone. Empty sellers drop out. */
export function filterSellers(sellers, chip = "all") {
  if (!chip || chip === "all") return sellers ?? [];
  return (sellers ?? [])
    .map((seller) => ({
      ...seller,
      players: (seller.players ?? []).filter((player) => player.league === chip),
    }))
    .filter((seller) => seller.players.length);
}

/**
 * "newest" puts the most recently listed player first and orders sellers by
 * their newest listing. "rank" keeps the league table order the server sent.
 */
export function sortSellers(sellers, mode = "newest") {
  if (mode !== "newest") return sellers ?? [];
  const sortedPlayers = (sellers ?? []).map((seller) => ({
    ...seller,
    players: [...(seller.players ?? [])].sort((a, b) => at(b.updated_at) - at(a.updated_at)),
  }));
  const newest = (seller) => at(seller.players[0]?.updated_at);
  return sortedPlayers.sort((a, b) => newest(b) - newest(a));
}

/** "ENG, ESP" for a list of league slugs. */
export function countryTags(leagues) {
  return (leagues ?? []).map((l) => ULTIMA_LEAGUE_SHORT[l]).filter(Boolean).join(", ");
}
