import { ULTIMA_LEAGUE_SHORT } from "@/lib/ultima/constants";

export const ULTIMA_FIXTURE_STATUSES = ["NS", "LIVE", "HT", "FT", "POSTP", "CANC", "ABAN"];

export const ULTIMA_FINISHED_STATUSES = new Set(["FT"]);
export const ULTIMA_LIVE_STATUSES = new Set(["LIVE", "HT"]);

/**
 * Every Sportmonks state we accept, keyed by the normalised raw token.
 * `canonical` is what we store. `bucket` is how the rest of Ultima treats it.
 * An absent key is unknown: callers must leave the stored status unchanged.
 */
const SPORTMONKS_STATES = {
  ns: { canonical: "NS", bucket: "ns" },
  not_started: { canonical: "NS", bucket: "ns" },
  scheduled: { canonical: "NS", bucket: "ns" },
  "n/s": { canonical: "NS", bucket: "ns" },
  tba: { canonical: "TBA", bucket: "ns" },
  "1st": { canonical: "1st", bucket: "live" },
  "1st_half": { canonical: "1st", bucket: "live" },
  inplay_1st_half: { canonical: "1st", bucket: "live" },
  ht: { canonical: "HT", bucket: "live" },
  halftime: { canonical: "HT", bucket: "live" },
  half_time: { canonical: "HT", bucket: "live" },
  "half-time": { canonical: "HT", bucket: "live" },
  "2nd": { canonical: "2nd", bucket: "live" },
  "2nd_half": { canonical: "2nd", bucket: "live" },
  inplay_2nd_half: { canonical: "2nd", bucket: "live" },
  live: { canonical: "LIVE", bucket: "live" },
  inplay: { canonical: "LIVE", bucket: "live" },
  break: { canonical: "BREAK", bucket: "live" },
  et: { canonical: "ET", bucket: "live" },
  pen_live: { canonical: "PEN_LIVE", bucket: "live" },
  ft: { canonical: "FT", bucket: "finished" },
  finished: { canonical: "FT", bucket: "finished" },
  fulltime: { canonical: "FT", bucket: "finished" },
  full_time: { canonical: "FT", bucket: "finished" },
  complete: { canonical: "FT", bucket: "finished" },
  completed: { canonical: "FT", bucket: "finished" },
  aet: { canonical: "AET", bucket: "finished" },
  ft_pen: { canonical: "FT_PEN", bucket: "finished" },
  pen: { canonical: "FT_PEN", bucket: "finished" },
  postp: { canonical: "POSTP", bucket: "non_playing" },
  postponed: { canonical: "POSTP", bucket: "non_playing" },
  canc: { canonical: "CANC", bucket: "non_playing" },
  cancelled: { canonical: "CANC", bucket: "non_playing" },
  canceled: { canonical: "CANC", bucket: "non_playing" },
  aban: { canonical: "ABAN", bucket: "abandoned" },
  abd: { canonical: "ABAN", bucket: "abandoned" },
  abandoned: { canonical: "ABAN", bucket: "abandoned" },
  susp: { canonical: "SUSP", bucket: "non_playing" },
  suspended: { canonical: "SUSP", bucket: "non_playing" },
  int: { canonical: "INT", bucket: "non_playing" },
  interrupted: { canonical: "INT", bucket: "non_playing" },
  delayed: { canonical: "DELAYED", bucket: "non_playing" },
  awarded: { canonical: "AWARDED", bucket: "non_playing" },
  wo: { canonical: "WO", bucket: "non_playing" },
  walkover: { canonical: "WO", bucket: "non_playing" },
};

function stateKey(raw) {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

/** Known Sportmonks state, or null when the token is not in the map. */
export function resolveSportmonksState(raw) {
  if (raw == null || String(raw).trim() === "") return SPORTMONKS_STATES.ns;
  return SPORTMONKS_STATES[stateKey(raw)] ?? null;
}

/**
 * Legacy bucket used by the rest of the app.
 * Unknown strings return null. They must not become NS or POSTP.
 */
export function normalizeFixtureStatus(raw) {
  const resolved = resolveSportmonksState(raw);
  if (!resolved) return null;
  if (resolved.canonical === "HT") return "HT";
  if (resolved.bucket === "live") return "LIVE";
  if (resolved.bucket === "finished") return "FT";
  if (resolved.bucket === "abandoned") return "ABAN";
  if (resolved.canonical === "POSTP" || resolved.canonical === "DELAYED") return "POSTP";
  if (resolved.bucket === "non_playing") return "CANC";
  return "NS";
}

export function isFinishedStatus(status) {
  return normalizeFixtureStatus(status) === "FT";
}

export function isLiveStatus(status) {
  const bucket = normalizeFixtureStatus(status);
  return bucket === "LIVE" || bucket === "HT";
}

export function isAbandonedStatus(status) {
  return resolveSportmonksState(status)?.bucket === "abandoned";
}

/** Postponed, cancelled, abandoned, and the other states that are not a match in play. */
export function isNonPlayingStatus(status) {
  const resolved = resolveSportmonksState(status);
  if (!resolved) return false;
  return resolved.bucket === "non_playing" || resolved.bucket === "abandoned";
}

/**
 * Canonical status to store. Null means unknown: leave the row unchanged.
 * Never returns POSTP for an unmapped token.
 */
export function storedStatusForRemote(raw) {
  return resolveSportmonksState(raw)?.canonical ?? null;
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
