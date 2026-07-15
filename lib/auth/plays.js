import { getServiceClient } from "@/lib/supabase";
import { gstDay } from "@/lib/guesser/config";

export async function getUserPlayedModes(userId, day = gstDay()) {
  const supabase = getServiceClient();
  if (!supabase || !userId) return [];
  const { data } = await supabase
    .from("plays")
    .select("mode")
    .eq("user_id", userId)
    .eq("puzzle_date", day);
  return data?.map((row) => row.mode) ?? [];
}
