import { getServiceClient } from "@/lib/supabase";
import { gstDay } from "@/lib/guesser/config";
import { guessPersonIdsFromRows } from "@/lib/guesser/dedupe";

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

/** In-progress or completed play for one mode/day (signed-in source of truth). */
export async function getUserGameProgress(userId, mode, day = gstDay()) {
  const supabase = getServiceClient();
  if (!supabase || !userId) {
    return {
      guesses: [],
      solved: false,
      attempts: 0,
      revealedClues: [],
      guessPersonIds: [],
    };
  }

  const { data } = await supabase
    .from("plays")
    .select("guesses, solved, attempts")
    .eq("user_id", userId)
    .eq("puzzle_date", day)
    .eq("mode", mode)
    .maybeSingle();

  if (!data) {
    return {
      guesses: [],
      solved: false,
      attempts: 0,
      revealedClues: [],
      guessPersonIds: [],
    };
  }

  const payload = data.guesses ?? {};
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  return {
    guesses: rows,
    solved: Boolean(data.solved),
    attempts: Number(data.attempts) || 0,
    revealedClues: Array.isArray(payload.revealedClues)
      ? payload.revealedClues
      : [],
    guessPersonIds: guessPersonIdsFromRows(rows),
  };
}
