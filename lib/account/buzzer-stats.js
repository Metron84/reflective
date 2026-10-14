/**
 * Reads The Guesser's buzzer boards out of `plays` rows (mode "buzzer"). Pure, so My Programme
 * and the honours share one reading of what a board scored.
 *
 * A row's `guesses` holds the run: { players: [{ st, pts, ok, pid }] }. Only finished boards count:
 * a board with a player still to play has no final score yet.
 */

export const BUZZER_MODE = "buzzer";
export const MAX_BOARD_SCORE = 20;

function dayBefore(day) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * @param {{mode?: string, puzzle_date: string, guesses?: {players?: object[]}}[]} plays
 * @returns {{day: string, score: number, points: number[], named: string[]}[]} finished boards, oldest first
 */
export function parseBuzzerBoards(plays) {
  const boards = [];
  for (const play of plays ?? []) {
    if (play.mode !== BUZZER_MODE) continue;
    const players = play.guesses?.players;
    if (!Array.isArray(players) || players.length === 0 || !players.every((p) => p.st === "done")) continue;
    boards.push({
      day: play.puzzle_date,
      score: players.reduce((sum, p) => sum + (Number(p.pts) || 0), 0),
      points: players.map((p) => Number(p.pts) || 0),
      named: players.filter((p) => p.ok && p.pid).map((p) => p.pid),
    });
  }
  return boards.sort((a, b) => a.day.localeCompare(b.day));
}

export const bestBoardScore = (boards) => boards.reduce((m, b) => Math.max(m, b.score), 0);

/** A player answered on the first clue (4 points). */
export const answeredOnClueOne = (boards) => boards.some((b) => b.points.some((p) => p === 4));

/** Longest run of consecutive days, each with a board scoring at least `min`. */
export function bestRun(boards, min = 10) {
  const days = [...new Set(boards.filter((b) => b.score >= min).map((b) => b.day))].sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const day of days) {
    run = prev && dayBefore(day) === prev ? run + 1 : 1;
    best = Math.max(best, run);
    prev = day;
  }
  return best;
}

/** Players named correctly across all boards, counted once each, for people the predicate accepts. */
export function namedCount(boards, accept) {
  const seen = new Set();
  for (const b of boards) for (const id of b.named) if (accept(id)) seen.add(id);
  return seen.size;
}

/** My Programme's Guesser tile: finished boards, today's score, best score. */
export function summariseGuesser(plays, today) {
  const boards = parseBuzzerBoards(plays);
  const todays = boards.find((b) => b.day === today);
  return {
    boards: boards.length,
    today: todays ? todays.score : null,
    best: boards.length ? bestBoardScore(boards) : null,
    max: MAX_BOARD_SCORE,
  };
}
