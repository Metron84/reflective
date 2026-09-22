import { ULTIMA_LEAGUE_SHORT } from "@/lib/ultima/constants";

export const ULTIMA_FIXTURE_STATUSES = ["NS", "LIVE", "HT", "FT", "POSTP", "CANC"];

export const ULTIMA_FINISHED_STATUSES = new Set(["FT"]);
export const ULTIMA_LIVE_STATUSES = new Set(["LIVE", "HT"]);

const FINISHED_ALIASES = new Set([
  "ft",
  "finished",
  "fulltime",
  "full_time",
  "complete",
  "completed",
  "aet",
  "pen",
  "ft_pen",
]);

const LIVE_ALIASES = new Set([
  "live",
  "inplay",
  "inplay_1st_half",
  "inplay_2nd_half",
  "1st_half",
  "2nd_half",
  "1st-half",
  "2nd-half",
]);

const HT_ALIASES = new Set(["ht", "halftime", "half_time", "break", "half-time"]);

const POSTP_ALIASES = new Set(["postp", "postponed", "delayed", "suspended"]);

const CANC_ALIASES = new Set(["canc", "cancelled", "canceled", "abandoned", "abd", "awarded"]);

export function normalizeFixtureStatus(raw) {
  const value = String(raw ?? "NS")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  if (ULTIMA_FIXTURE_STATUSES.includes(String(raw ?? "").toUpperCase())) {
    return String(raw).toUpperCase();
  }
  if (FINISHED_ALIASES.has(value)) return "FT";
  if (HT_ALIASES.has(value)) return "HT";
  if (LIVE_ALIASES.has(value)) return "LIVE";
  if (POSTP_ALIASES.has(value)) return "POSTP";
  if (CANC_ALIASES.has(value)) return "CANC";
  if (value === "ns" || value === "not_started" || value === "scheduled" || value === "n/s") {
    return "NS";
  }
  return "NS";
}

export function isFinishedStatus(status) {
  return ULTIMA_FINISHED_STATUSES.has(normalizeFixtureStatus(status));
}

export function isLiveStatus(status) {
  return ULTIMA_LIVE_STATUSES.has(normalizeFixtureStatus(status));
}

export function leagueCodeForSlug(slug) {
  return ULTIMA_LEAGUE_SHORT[slug] ?? null;
}

export function slugFromLeagueCode(code) {
  const upper = String(code ?? "").toUpperCase();
  return (
    Object.entries(ULTIMA_LEAGUE_SHORT).find(([, tag]) => tag === upper)?.[0] ?? null
  );
}
