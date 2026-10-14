import { bestClubPerLeague } from "@/lib/crest/match.js";
import { leaguePalette } from "@/lib/crest/colour.js";

/**
 * Per-user cache. An entry is reused only while crest_results.saved_at is unchanged,
 * so a re-swipe (which rewrites the row) invalidates it. Process-local by design:
 * a cold instance just recomputes, which costs a few milliseconds.
 */
const CACHE = new Map();
const MAX_ENTRIES = 500;

function compute(answers, stake, scope) {
  return bestClubPerLeague(answers, { stake, scope }).map(({ competition, label, club, matchPct }) => ({
    competition,
    label,
    clubSlug: club.slug,
    clubName: club.name,
    // crest_clubs is not populated yet, so there is no badge image. The UI shows the club name.
    badge_url: null,
    ...leaguePalette(club.color),
    matchPct,
  }));
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
    .select("saved_at, stake, scope")
    .eq("user_id", userId)
    .maybeSingle();
  if (head.error || !head.data) return null;

  const { saved_at: savedAt, stake, scope } = head.data;
  const hit = CACHE.get(userId);
  if (hit && hit.savedAt === savedAt) return hit;

  const full = await supabase
    .from("crest_results")
    .select("answers")
    .eq("user_id", userId)
    .maybeSingle();
  if (full.error || !Array.isArray(full.data?.answers)) return null;

  const entry = { savedAt, leagues: compute(full.data.answers, stake, scope) };
  if (CACHE.size >= MAX_ENTRIES) CACHE.delete(CACHE.keys().next().value);
  CACHE.set(userId, entry);
  return entry;
}

export function clearCrestLeaguesCache() {
  CACHE.clear();
}
