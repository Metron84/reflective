import { ULTIMA_LEAGUES } from "@/lib/ultima/constants";

const LEAGUE_ENV_KEYS = {
  pl: "SPORTMONKS_LEAGUE_ID_PL",
  laliga: "SPORTMONKS_LEAGUE_ID_LALIGA",
  seriea: "SPORTMONKS_LEAGUE_ID_SERIEA",
  bundesliga: "SPORTMONKS_LEAGUE_ID_BUNDESLIGA",
  ligue1: "SPORTMONKS_LEAGUE_ID_LIGUE1",
};

export function getSportmonksLeagueId(league) {
  const key = LEAGUE_ENV_KEYS[league];
  if (!key) return null;
  const value = process.env[key];
  return value ? String(value).trim() : null;
}

export function getSportmonksLeagueMap() {
  const map = {};
  for (const league of ULTIMA_LEAGUES) {
    const id = getSportmonksLeagueId(league);
    if (id) map[league] = id;
  }
  return map;
}

export function statTypeIds() {
  return {
    goals: Number(process.env.SPORTMONKS_STAT_GOALS ?? 52),
    assists: Number(process.env.SPORTMONKS_STAT_ASSISTS ?? 79),
    rating: Number(process.env.SPORTMONKS_STAT_RATING ?? 118),
  };
}

export const SPORTMONKS_BASE = "https://api.sportmonks.com/v3/football";

export function sportmonksApiKey() {
  return process.env.SPORTMONKS_API_KEY?.trim() ?? "";
}
