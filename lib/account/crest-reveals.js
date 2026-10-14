import { getServiceClient } from "@/lib/supabase";
import { getCrestLeagues } from "@/lib/account/crest-leagues";
import { awardBadge } from "@/lib/account/badges";

/** True when the revealed competitions cover every league the member has. */
export function coversEveryLeague(leagues, revealed) {
  return leagues.length > 0 && leagues.every((l) => revealed.includes(l.competition));
}

/**
 * Leagues the member has revealed for their current Crest result. Rows older than
 * crest_results.saved_at belong to a previous result and are ignored.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient|null} supabase  user-scoped or render client
 * @param {string} userId
 * @param {{savedAt: string, leagues: {competition: string}[]}|null} crest
 * @returns {Promise<string[]>}
 */
export async function getRevealed(supabase, userId, crest) {
  if (!supabase || !userId || !crest) return [];
  const { data, error } = await supabase
    .from("crest_reveals")
    .select("competition, revealed_at")
    .eq("user_id", userId);
  if (error || !data) return [];
  const since = Date.parse(crest.savedAt);
  const known = new Set(crest.leagues.map((l) => l.competition));
  return data
    .filter((r) => known.has(r.competition) && Date.parse(r.revealed_at) >= since)
    .map((r) => r.competition);
}

/** Drop a member's reveals. Called when their Crest result is saved again. */
export async function clearReveals(userId) {
  const supabase = getServiceClient();
  if (!supabase || !userId) return;
  await supabase.from("crest_reveals").delete().eq("user_id", userId);
}

/**
 * Record one reveal. The insert runs as the member, so RLS limits it to their own row.
 * Awards every_league when the member's reveals now cover every league.
 *
 * @returns {Promise<{status: number, error?: string, revealed?: string[], everyLeague?: boolean}>}
 */
export async function revealLeague(supabase, userId, competition) {
  const crest = await getCrestLeagues(supabase, userId);
  if (!crest) return { status: 409, error: "Swipe The Crest first." };
  if (!crest.leagues.some((l) => l.competition === competition)) {
    return { status: 400, error: "Unknown league." };
  }

  // A row left over from an earlier Crest result would block the insert. Clear it first.
  const service = getServiceClient();
  if (service) {
    await service
      .from("crest_reveals")
      .delete()
      .eq("user_id", userId)
      .lt("revealed_at", crest.savedAt);
  }

  const { error } = await supabase
    .from("crest_reveals")
    .upsert({ user_id: userId, competition }, { onConflict: "user_id,competition", ignoreDuplicates: true });
  if (error) return { status: 500, error: "Could not save your reveal." };

  const revealed = await getRevealed(supabase, userId, crest);
  const everyLeague = coversEveryLeague(crest.leagues, revealed);
  if (everyLeague) await awardBadge(userId, "every_league");
  return { status: 200, revealed, everyLeague };
}
