/**
 * Mark the player's row in a weekly board, or slot a pending row in where the score would rank.
 * `you` is the finished game's summary: { score, correct, answered }. Rows are never mutated.
 */
export function markPlayer(rows, you) {
  if (!you) return rows.map((r) => ({ ...r, isYou: false }));
  const hit = rows.findIndex(
    (r) => r.score === you.score && r.correct === you.correct && r.answered === you.answered,
  );
  if (hit >= 0) return rows.map((r, i) => ({ ...r, isYou: i === hit }));

  let at = rows.findIndex((r) => r.score < you.score);
  if (at < 0) at = rows.length;
  const pending = {
    rank: at > 0 && rows[at - 1].score === you.score ? rows[at - 1].rank : at + 1,
    display_name: "You",
    score: you.score,
    correct: you.correct,
    answered: you.answered,
    isYou: true,
    pending: true,
  };
  const below = rows.slice(at).map((r) => ({ ...r, rank: r.rank + 1, isYou: false }));
  return [...rows.slice(0, at).map((r) => ({ ...r, isYou: false })), pending, ...below];
}

/** Screen changes that keep the finished game: results to leaderboard and back. */
export function stageAfter(stage, action, finish) {
  if (action === "leaderboard" && stage === "end" && finish) return "leaderboard";
  if (action === "back" && stage === "leaderboard" && finish) return "end";
  return stage;
}
