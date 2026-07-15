import { readFileSync } from "fs";
import path from "path";

let clubListCache;

export function getClubOptions() {
  if (clubListCache) return clubListCache;
  const file = path.join(process.cwd(), "data", "players_seed.json");
  const seed = JSON.parse(readFileSync(file, "utf8"));
  const set = new Set();
  for (const player of seed.players ?? []) {
    for (const club of player.clubs ?? []) {
      if (club) set.add(club);
    }
  }
  clubListCache = [...set].sort((a, b) => a.localeCompare(b));
  return clubListCache;
}

export function filterClubOptions(query, limit = 12) {
  const q = query.trim().toLowerCase();
  const all = getClubOptions();
  if (!q) return all.slice(0, limit);
  return all.filter((club) => club.toLowerCase().includes(q)).slice(0, limit);
}
