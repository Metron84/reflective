/**
 * The buzzer game's rules. Pure: no clock, no I/O, no answers. Every function takes `now` (server
 * milliseconds) and a player state, and returns the next state. The server is the only caller, and
 * it always passes its own clock, so the client's timestamps never matter.
 *
 * One player's round, in BUZZER_WINDOW_SECONDS (10s) steps from the moment it starts. A clue and its
 * point value always change together, because both are read from the same window index:
 *   window 1  clue 1            worth 4
 *   window 2  clues 1-2         worth 3
 *   window 3  clues 1-3         worth 2
 *   window 4  clues 1-4         worth 1
 *   window 5  final window      worth 1 (no new clue)
 *   then      0 points, the answer is revealed
 * Tapping to answer freezes the clock and opens ANSWER_MS to type. A right answer scores the frozen
 * value. A wrong answer, or running out of typing time, costs no points: the clock resumes where it
 * stopped and the buzzer is locked until the next window starts (the next clue, and the next point
 * value). Then the player can buzz again at that value. A wrong answer in the final window ends the
 * player at 0 points and reveals the name. Wrong guesses are remembered so they cannot be repeated.
 */

/**
 * Length of one point window, in seconds. The single source for the UI (cylinders, clue timing,
 * copy) and the server's timing. Change it here and both move together.
 */
export const BUZZER_WINDOW_SECONDS = 10;
export const WINDOW_MS = BUZZER_WINDOW_SECONDS * 1000;
export const CLUE_MS = WINDOW_MS; // a new clue lands at the start of each of windows 2 to 4
export const CLUE_COUNT = 4;
export const FINAL_MS = WINDOW_MS;
export const ROUND_MS = CLUE_MS * CLUE_COUNT + FINAL_MS; // 5 windows
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
  if (ms < WINDOW_MS) return 4;
  if (ms < WINDOW_MS * 2) return 3;
  if (ms < WINDOW_MS * 3) return 2;
  if (ms < ROUND_MS) return 1; // clue 4 window and the final window
  return 0;
}

/** How many clues are showing after `ms` of running clock (1 to 4). */
export function cluesAt(ms) {
  return Math.min(CLUE_COUNT, 1 + Math.floor(Math.max(0, ms) / WINDOW_MS));
}

export function newPlayer() {
  // lk: the running clock reading at which the buzzer unlocks again. wg: wrong guesses (person ids).
  return { st: "pending", t0: 0, pz: 0, bz: null, fe: 0, w: 0, lk: 0, wg: [], pts: 0, ok: false, pid: null, g: null };
}

/** Clock reading at which this player's buzzer unlocks. Boards saved under the one-guess rule stay locked. */
export function lockUntil(p) {
  if (p.lk != null) return p.lk;
  return p.w ? ROUND_MS : 0;
}

export const wrongGuesses = (p) => p.wg ?? [];

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
    miss(p, p.bz + ANSWER_MS, null, pidAt(i));
  }
  if (p.bz == null && now - p.t0 - p.pz >= ROUND_MS) finish(p, 0, false, pidAt(i));
  return next;
}

/**
 * A wrong answer or an expired typing window. No points are lost and the typing time is not charged to
 * the clock. In the final window it ends the player at 0; otherwise the buzzer locks until the next
 * window starts.
 */
function miss(p, resumeAt, guessPid, pid) {
  const frozenAt = p.fe;
  p.pz += Math.min(Math.max(0, resumeAt - p.bz), ANSWER_MS);
  p.bz = null;
  p.w = 1;
  if (guessPid) p.wg = [...wrongGuesses(p), guessPid];
  if (frozenAt >= CLUE_COUNT * WINDOW_MS) {
    finish(p, 0, false, pid);
    return;
  }
  p.lk = (Math.floor(frozenAt / WINDOW_MS) + 1) * WINDOW_MS;
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
  const raw = now - p.t0 - p.pz;
  if (raw < lockUntil(p)) return { board: next, ok: false, reason: "locked-out" };
  p.bz = now;
  // The grace never reaches back into the window the lock covered.
  p.fe = Math.max(lockUntil(p), raw - BUZZ_GRACE_MS, 0);
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
  p.g = guessPid;
  miss(p, now, guessPid, answerPid);
  const settled = settle(next, now, pidAt);
  return { board: settled, ok: true, correct: false, points: 0, ended: settled.players[i].st === "done" };
}
