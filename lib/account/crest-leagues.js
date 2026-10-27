import { DEFAULT_ALPHA, rankClubs } from "@/lib/crest/match.js";
import { PYRAMID_LEAGUES } from "@/lib/crest/competitions.js";
import { leaguePalette } from "@/lib/crest/colour.js";
import { clubMedia } from "@/lib/crest/club-media.js";
import { matchPercent } from "@/lib/crest/report.js";

/**
 * Per-user cache. An entry is reused only while crest_results.saved_at is unchanged,
 * so a re-swipe (which rewrites the row) invalidates it. Process-local by design:
 * a cold instance just recomputes, which costs a few milliseconds.
 */
const CACHE = new Map();
const MAX_ENTRIES = 500;

function leagueOf(club) {
  return club.division || club.league || club.competition || "";
}

function compute(answers, stake, scope) {
  const ranked = rankClubs(answers, DEFAULT_ALPHA, {
    group: scope || null,
    stake: stake || null,
    colour: null,
    competition: null,
  });
  return PYRAMID_LEAGUES.map((league) => {
    const top = ranked.find((row) => leagueOf(row.club) === league.competition);
    if (!top) {
      return {
        competition: league.competition,
        label: league.label,
        country: league.country,
        clubSlug: null,
        clubName: null,
        percentage: null,
        badge_url: null,
        primary: "#0A111F",
        secondary: "#D8232A",
        text: "#F2EDE4",
      };
    }
    const media = clubMedia(top.club.slug);
    return {
      competition: league.competition,
      label: league.label,
      country: league.country,
      clubSlug: top.club.slug,
      clubName: top.club.name,
      percentage: matchPercent(top.score),
      badge_url: media?.badge_url ?? null,
      ...leaguePalette(top.club.color, media),
    };
  });
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient|null} supabase  user-scoped or render client
 * @param {string} userId
 * @returns {Promise<{savedAt: string, leagues: object[]}|null>} null when the member has no crest_results row
 */
export async function getCrestLeagues(supabase, userId) {
  if (!supabase || !userId) return null;

  const head = await supabase
    .from("crest_results")
    .select("saved_at, stake, scope, club_slug")
    .eq("user_id", userId)
    .maybeSingle();
  if (head.error || !head.data) return null;

  const { saved_at: savedAt, stake, scope } = head.data;
  const hit = CACHE.get(userId);
  if (hit && hit.savedAt === savedAt) return hit;

  const full = await supabase
    .from("crest_results")
    .select("answers, fc_results")
    .eq("user_id", userId)
    .maybeSingle();
  if (full.error || !Array.isArray(full.data?.answers)) return null;

  const fc = full.data.fc_results;
  const entry = {
    savedAt,
    leagues: compute(full.data.answers, stake, scope),
    clubs: Array.isArray(fc?.clubs)
      ? [...fc.clubs].sort((a, b) => b.percentage - a.percentage || a.name.localeCompare(b.name))
      : [],
  };
  if (CACHE.size >= MAX_ENTRIES) CACHE.delete(CACHE.keys().next().value);
  CACHE.set(userId, entry);
  return entry;
}

export function clearCrestLeaguesCache() {
  CACHE.clear();
}
