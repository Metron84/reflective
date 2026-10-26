import { bestClubPerLeague } from "@/lib/crest/match.js";
import { leaguePalette } from "@/lib/crest/colour.js";
import { clubMedia } from "@/lib/crest/club-media.js";
import { RIVALS } from "@/lib/crest/rivals.js";

/**
 * Per-user cache. An entry is reused only while crest_results.saved_at is unchanged,
 * so a re-swipe (which rewrites the row) invalidates it. Process-local by design:
 * a cold instance just recomputes, which costs a few milliseconds.
 */
const CACHE = new Map();
const MAX_ENTRIES = 500;

function presentClub(club) {
  const media = clubMedia(club.slug);
  return {
    slug: club.slug,
    name: club.name,
    country: club.country,
    flag: club.flag || "",
    percentage: club.percentage,
    badge_url: media?.badge_url ?? null,
    ...leaguePalette(club.color, media),
  };
}

function rowsFromFc(fc) {
  return (fc.regions || []).flatMap((row) => {
    if (!row.ranked?.[0]) return [];
    const top = presentClub(row.ranked[0]);
    const wide = row.region === "Rest of the World";
    return {
      competition: row.region,
      label: row.label,
      percentage: row.percentage,
      flag: top.flag,
      country: top.country,
      clubSlug: top.slug,
      clubName: top.name,
      ranked: wide ? row.ranked.map(presentClub) : null,
      badge_url: top.badge_url,
      primary: top.primary,
      secondary: top.secondary,
      text: top.text,
    };
  });
}

function compute(answers, stake, scope, home) {
  return bestClubPerLeague(answers, { stake, scope, home, rivals: RIVALS }).map(({ competition, label, club }) => {
    const media = clubMedia(club.slug);
    return {
      competition,
      label,
      clubSlug: club.slug,
      clubName: club.name,
      // Null for a club with no Sportmonks match; the row then shows the name on club.color.
      badge_url: media?.badge_url ?? null,
      ...leaguePalette(club.color, media),
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

  const { saved_at: savedAt, stake, scope, club_slug: home } = head.data;
  const hit = CACHE.get(userId);
  if (hit && hit.savedAt === savedAt) return hit;

  const full = await supabase
    .from("crest_results")
    .select("answers, fc_results")
    .eq("user_id", userId)
    .maybeSingle();
  if (full.error || !Array.isArray(full.data?.answers)) return null;

  const fc = full.data.fc_results;
  const entry = fc?.regions?.length
    ? {
        savedAt,
        leagues: rowsFromFc(fc),
        clubs: [...fc.clubs].sort((a, b) => b.percentage - a.percentage || a.name.localeCompare(b.name)),
      }
    : { savedAt, leagues: compute(full.data.answers, stake, scope, home), clubs: [] };
  if (CACHE.size >= MAX_ENTRIES) CACHE.delete(CACHE.keys().next().value);
  CACHE.set(userId, entry);
  return entry;
}

export function clearCrestLeaguesCache() {
  CACHE.clear();
}
