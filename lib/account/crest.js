import { getRenderClient } from "@/lib/supabase/server";
import { CLUBS } from "@/lib/crest/clubs";
import { getStake } from "@/lib/crest/stakes";

/**
 * @param {string} userId
 */
export async function getSavedCrest(userId) {
  const supabase = await getRenderClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("crest_results")
    .select("club_slug, room_pct, stake, scope, saved_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  const club = CLUBS.find((row) => row.slug === data.club_slug);
  const stake = getStake(data.stake);
  return {
    clubSlug: data.club_slug,
    clubName: club?.name || data.club_slug,
    clubColor: club?.color || "#D8232A",
    roomPct: data.room_pct,
    stakeLabel: stake?.label || null,
    scope: data.scope,
    savedAt: data.saved_at,
  };
}
