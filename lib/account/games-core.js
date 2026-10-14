import { dubaiDay, dubaiWeekStart } from "@/lib/play/week.js";
import { summariseGuesser as summariseBuzzer } from "@/lib/account/buzzer-stats.js";

/** The member's leaderboard row this week, matched on the claimed game's completion time. */
export function weekRank(quizRows, leaderRows, week) {
  const mine = quizRows
    .filter((r) => r.counted && r.week_start === week)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.correct - a.correct ||
        a.answered - b.answered ||
        Date.parse(a.completed_at) - Date.parse(b.completed_at)
    )[0];
  if (!mine) return null;
  const at = Date.parse(mine.completed_at);
  const row = leaderRows.find(
    (r) => r.score === mine.score && Date.parse(r.completed_at) === at
  );
  return row ? row.rank : null;
}

export function summariseQuiz(quizRows, leaderRows, now = new Date()) {
  const today = dubaiDay(now);
  const week = dubaiWeekStart(now);
  return {
    played: quizRows.length,
    best: quizRows.reduce((m, r) => Math.max(m, r.correct), 0),
    rank: weekRank(quizRows, leaderRows, week),
    openToday: !quizRows.some((r) => r.counted && r.play_day === today),
  };
}

/** `meta` is { ranks, totalPuzzles, rankFor }, injected so this file stays free of JSON and DB imports. */
export function summariseCodemaster(solvedCount, { ranks, totalPuzzles, rankFor }) {
  const rank = rankFor(solvedCount, ranks);
  return {
    solved: solvedCount,
    title: rank.title,
    // Past the starting rank: the first rank above it earns Codebreaker.
    hasRankedUp: rank.key !== ranks[0].key,
    inProgress: solvedCount > 0 && solvedCount < totalPuzzles,
    rankedUpAt: ranks[1]?.at ?? null,
  };
}

/** The Guesser tile: finished buzzer boards, today's score out of 20, and the best score. */
export function summariseGuesser(buzzerRows, now = new Date()) {
  return summariseBuzzer(buzzerRows, dubaiDay(now));
}

export function buildGames(facts, meta, now = new Date()) {
  return {
    quiz: summariseQuiz(facts.quizRows, facts.leaderRows, now),
    codemaster: summariseCodemaster(facts.solvedCount, meta),
    guesser: summariseGuesser(facts.buzzerRows ?? [], now),
  };
}
