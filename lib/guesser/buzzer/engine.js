/**
 * The buzzer game's rules. Pure: no clock, no I/O, no answers. Every function takes `now` (server
 * milliseconds) and a player state, and returns the next state. The server is the only caller, and
 * it always passes its own clock, so the client's timestamps never matter.
 *
 * One player's round, in 5 second steps from the moment it starts:
 *   0-5s   clue 1            worth 4
 *   5-10s  clues 1-2         worth 3
 *   10-15s clues 1-3         worth 2
 *   15-20s clues 1-4         worth 1
 *   20-25s final window      worth 1
 *   25s    0 points, the answer is revealed
 * Tapping to answer freezes the clock and opens ANSWER_MS to type. A right answer scores the frozen
 * value. A wrong answer, or running out of typing time, costs no points: the clock resumes where it
 * stopped and the player is locked out (one wrong guess per player).
 */

export const CLUE_MS = 5000;
export const CLUE_COUNT = 4;
export const FINAL_MS = 5000;
export const ROUND_MS = CLUE_MS * CLUE_COUNT + FINAL_MS; // 25s
export const ANSWER_MS = 10000;
export const PLAYERS_PER_BOARD = 5;
export const MAX_SCORE = PLAYERS_PER_BOARD * CLUE_COUNT; // 20

/** Allowance for the trip from the player's tap to the server, taken off the clock at the tap. */
export const BUZZ_GRACE_MS = 300;
/** Slack on the typing deadline for the same reason. */
export const ANSWER_GRACE_MS = 1500;

/** Points on offer after `ms` of running clock. */
export function valueAt(ms) {
  if (ms < 0) return CLUE_COUNT;
  if (ms < CLUE_MS) return 4;
  if (ms < CLUE_MS * 2) return 3;
  if (ms < CLUE_MS * 3) return 2;
  if (ms < ROUND_MS) return 1; // clue 4 window and the final window
  return 0;
}

/** How many clues are showing after `ms` of running clock (1 to 4). */
export function cluesAt(ms) {
  return Math.min(CLUE_COUNT, 1 + Math.floor(Math.max(0, ms) / CLUE_MS));
}

export function newPlayer() {
  return { st: "pending", t0: 0, pz: 0, bz: null, fe: 0, w: 0, pts: 0, ok: false, pid: null, g: null };
}

export function newBoard() {
  return { v: 1, rev: 0, players: Array.from({ length: PLAYERS_PER_BOARD }, newPlayer) };
}

/** Running clock for a live player: frozen while the answer window is open. */
export function elapsed(p, now) {
  if (p.st !== "live") return p.st === "done" ? ROUND_MS : 0;
  if (p.bz != null) return p.fe;
  return Math.max(0, now - p.t0 - p.pz);
}

/** Index of the player in play: the first one not done. -1 when the board is finished. */
export function currentIndex(board) {
  return board.players.findIndex((p) => p.st !== "done");
}

export function isComplete(board) {
  return board.players.every((p) => p.st === "done");
}

export function score(board) {
  return board.players.reduce((sum, p) => sum + (p.st === "done" ? p.pts : 0), 0);
}

function clone(board) {
  return { ...board, players: board.players.map((p) => ({ ...p })) };
}

function finish(p, points, ok, pid) {
  p.st = "done";
  p.bz = null;
  p.pts = points;
  p.ok = ok;
  p.pid = pid;
}

/**
 * Apply anything the clock has decided since the last request: an expired typing window counts as
 * the wrong guess, and a round that has run out is closed at 0 points.
 * `pidAt(index)` gives the person id of that board slot, recorded on the player when it ends.
 */
export function settle(board, now, pidAt) {
  const next = clone(board);
  const i = currentIndex(next);
  if (i < 0) return next;
  const p = next.players[i];
  if (p.st !== "live") return next;

  if (p.bz != null && now > p.bz + ANSWER_MS + ANSWER_GRACE_MS) {
    p.pz += ANSWER_MS;
    p.bz = null;
    p.w = 1;
  }
  if (p.bz == null && now - p.t0 - p.pz >= ROUND_MS) finish(p, 0, false, pidAt(i));
  return next;
}

/** Start the clock for the next player. Does nothing if one is already running or the board is done. */
export function start(board, now, pidAt) {
  const next = settle(board, now, pidAt);
  const i = currentIndex(next);
  if (i < 0) return next;
  const p = next.players[i];
  if (p.st === "pending") {
    p.st = "live";
    p.t0 = now;
    p.pz = 0;
  }
  return next;
}

/**
 * Tap to answer. Freezes the clock at the server's reading, less BUZZ_GRACE_MS.
 * @returns {{board: object, ok: boolean, reason?: string}}
 */
export function buzz(board, now, pidAt) {
  const next = settle(board, now, pidAt);
  const i = currentIndex(next);
  if (i < 0) return { board: next, ok: false, reason: "done" };
  const p = next.players[i];
  if (p.st !== "live") return { board: next, ok: false, reason: "not-started" };
  if (p.bz != null) return { board: next, ok: false, reason: "already-frozen" };
  if (p.w) return { board: next, ok: false, reason: "locked-out" };
  const raw = now - p.t0 - p.pz;
  p.bz = now;
  p.fe = Math.max(0, raw - BUZZ_GRACE_MS);
  return { board: next, ok: true };
}

/**
 * Submit the answer for the frozen player. `guessPid` is the person the player named.
 * @returns {{board: object, ok: boolean, reason?: string, correct?: boolean, points?: number}}
 */
export function answer(board, now, guessPid, answerPid, pidAt) {
  const next = settle(board, now, pidAt);
  const i = currentIndex(next);
  if (i < 0) return { board: next, ok: false, reason: "done" };
  const p = next.players[i];
  if (p.st !== "live" || p.bz == null) return { board: next, ok: false, reason: "not-frozen" };

  if (guessPid === answerPid) {
    const points = valueAt(p.fe);
    finish(p, points, true, answerPid);
    return { board: next, ok: true, correct: true, points };
  }

  // Wrong: no points lost. The time spent typing is not charged to the clock.
  p.pz += Math.min(Math.max(0, now - p.bz), ANSWER_MS);
  p.bz = null;
  p.w = 1;
  p.g = guessPid;
  const settled = settle(next, now, pidAt);
  return { board: settled, ok: true, correct: false, points: 0 };
}
