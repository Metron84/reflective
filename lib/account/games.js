import { getServiceClient } from "@/lib/supabase";
import { ranks, totalPuzzles } from "@/public/codemaster/codemaster.json";
import { rankFor } from "@/lib/codemaster/engine";
import { dubaiWeekStart } from "@/lib/play/week.js";
import { buildGames as buildGamesCore } from "@/lib/account/games-core.js";

/** Rows are read per game from its own table. Nothing here is copied or cached. */

export async function loadGameFacts(userId) {
  const supabase = getServiceClient();
  if (!supabase) return { quizRows: [], solvedCount: 0, leaderRows: [] };

  const week = dubaiWeekStart();
  const [quiz, solves, leaders] = await Promise.all([
    supabase
      .from("fan_quiz_scores")
      .select("score, correct, answered, skipped, counted, play_day, week_start, completed_at")
      .eq("user_id", userId),
    supabase
      .from("codemaster_solves")
      .select("puzzle_id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("fan_quiz_leaderboard")
      .select("rank, display_name, score, completed_at")
      .eq("week_start", week)
      .order("rank", { ascending: true })
      .limit(1000),
  ]);

  return {
    quizRows: quiz.data ?? [],
    solvedCount: solves.count ?? 0,
    leaderRows: leaders.data ?? [],
  };
}

export function buildGames(facts, modeStats, now = new Date()) {
  return buildGamesCore(facts, modeStats, { ranks, totalPuzzles, rankFor }, now);
}
