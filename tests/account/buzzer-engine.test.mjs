import test from "node:test";
import assert from "node:assert/strict";
import {
  ANSWER_GRACE_MS,
  ANSWER_MS,
  BUZZ_GRACE_MS,
  MAX_SCORE,
  ROUND_MS,
  WINDOW_MS,
  lockUntil,
  wrongGuesses,
  BUZZER_WINDOW_SECONDS,
  answer,
  buzz,
  cluesAt,
  currentIndex,
  elapsed,
  isComplete,
  newBoard,
  score,
  settle,
  start,
  valueAt,
} from "@/lib/guesser/buzzer/engine.js";

const pidAt = (i) => `p${i}`;
const T0 = 1_000_000;

function live(now = T0) {
  return start(newBoard(), now, pidAt);
}

test("points step 4, 3, 2, 1 every 10 seconds, then the final window is still 1, then 0", () => {
  assert.equal(BUZZER_WINDOW_SECONDS, 10);
  const cases = [[0, 4], [9999, 4], [10000, 3], [19999, 3], [20000, 2], [29999, 2], [30000, 1], [39999, 1], [40000, 1], [49999, 1], [50000, 0]];
  for (const [ms, pts] of cases) assert.equal(valueAt(ms), pts, `${ms}ms`);
  assert.equal(ROUND_MS, 50000);
  assert.equal(MAX_SCORE, 20);
});

test("a new clue lands every 10 seconds, up to 4", () => {
  assert.deepEqual([0, 9999, 10000, 20000, 30000, 49000].map(cluesAt), [1, 1, 2, 3, 4, 4]);
});

test("a clue and its point value change at the same instant, across the whole round", () => {
  // Window k (0-based) shows k+1 clues for 4-k points, except the final window, which adds no clue.
  for (let k = 0; k < 5; k++) {
    for (const off of [0, 1, WINDOW_MS - 1]) {
      const ms = k * WINDOW_MS + off;
      assert.equal(valueAt(ms), Math.max(1, 4 - k), `value at ${ms}`);
      assert.equal(cluesAt(ms), Math.min(4, k + 1), `clues at ${ms}`);
    }
  }
  for (let k = 1; k < 4; k++) {
    assert.notEqual(valueAt(k * WINDOW_MS - 1), valueAt(k * WINDOW_MS));
    assert.notEqual(cluesAt(k * WINDOW_MS - 1), cluesAt(k * WINDOW_MS));
  }
});

test("a correct answer scores the value frozen at the tap", () => {
  const b0 = live();
  const { board: b1, ok } = buzz(b0, T0 + 12200 + BUZZ_GRACE_MS, pidAt); // raw 12.5s, 12.2s after grace
  assert.equal(ok, true);
  const res = answer(b1, T0 + 14000, "p0", "p0", pidAt);
  assert.equal(res.correct, true);
  assert.equal(res.points, 3);
  assert.equal(res.board.players[0].pts, 3);
  assert.equal(res.board.players[0].st, "done");
});

test("the clock is frozen while typing: waiting does not lower the score", () => {
  const b1 = buzz(live(), T0 + 2000, pidAt).board;
  // Nine seconds later the raw clock would read 11s (worth 2), but the tap froze it at about 1.7s.
  const res = answer(b1, T0 + 11000, "p0", "p0", pidAt);
  assert.equal(res.points, 4);
});

test("a wrong answer costs nothing and the drain resumes where it stopped", () => {
  const b1 = buzz(live(), T0 + 3000, pidAt).board;
  const wrong = answer(b1, T0 + 8000, "nope", "p0", pidAt); // 5s spent typing
  assert.equal(wrong.correct, false);
  assert.equal(wrong.points, 0);
  const p = wrong.board.players[0];
  assert.equal(p.st, "live");
  assert.equal(p.w, 1);
  assert.equal(p.bz, null);
  // Resumed at 3s of clock, not 8s: 4 seconds on it reads 7s.
  assert.equal(elapsed(p, T0 + 12000), 7000);
  assert.equal(valueAt(elapsed(p, T0 + 12000)), 4);
  assert.equal(valueAt(elapsed(p, T0 + 17000)), 3);
});

test("one wrong guess per player: after it the buzzer is locked", () => {
  const b1 = buzz(live(), T0 + 1000, pidAt).board;
  const b2 = answer(b1, T0 + 2000, "nope", "p0", pidAt).board;
  const again = buzz(b2, T0 + 3000, pidAt);
  assert.equal(again.ok, false);
  assert.equal(again.reason, "locked-out");
});

test("running out of typing time counts as the wrong guess", () => {
  const b1 = buzz(live(), T0 + 4000, pidAt).board;
  const later = settle(b1, T0 + 4000 + ANSWER_MS + ANSWER_GRACE_MS + 1, pidAt);
  const p = later.players[0];
  assert.equal(p.w, 1);
  assert.equal(p.bz, null);
  assert.equal(p.st, "live");
  assert.equal(p.pz, ANSWER_MS);
});

test("an answer sent after the typing window is not accepted as correct", () => {
  const b1 = buzz(live(), T0 + 1000, pidAt).board;
  const res = answer(b1, T0 + 1000 + ANSWER_MS + ANSWER_GRACE_MS + 500, "p0", "p0", pidAt);
  assert.equal(res.ok, false);
  assert.equal(res.board.players[0].pts, 0);
});

test("a round nobody answers ends after the final window with 0 points", () => {
  const b = settle(live(), T0 + ROUND_MS, pidAt);
  assert.equal(b.players[0].st, "done");
  assert.equal(b.players[0].pts, 0);
  assert.equal(b.players[0].ok, false);
  assert.equal(b.players[0].pid, "p0");
});

test("a buzz inside the final window scores 1", () => {
  const b1 = buzz(live(), T0 + 45000, pidAt).board;
  assert.equal(answer(b1, T0 + 46000, "p0", "p0", pidAt).points, 1);
});

test("a buzz after the round has run out is refused", () => {
  const res = buzz(live(), T0 + ROUND_MS + 10, pidAt);
  assert.equal(res.ok, false);
  assert.equal(res.board.players[0].st, "done");
});

test("the grace takes a little off the clock so a laggy tap near a boundary keeps the higher value", () => {
  // The player tapped at 9.9s but the request landed at 10.1s.
  const b1 = buzz(live(), T0 + 10100, pidAt).board;
  assert.equal(answer(b1, T0 + 10200, "p0", "p0", pidAt).points, 4);
  // A tap well past the boundary is still 3.
  const b2 = buzz(live(), T0 + 10600, pidAt).board;
  assert.equal(answer(b2, T0 + 10700, "p0", "p0", pidAt).points, 3);
});

test("you cannot answer without tapping first", () => {
  const res = answer(live(), T0 + 1000, "p0", "p0", pidAt);
  assert.equal(res.ok, false);
  assert.equal(res.reason, "not-frozen");
});

test("start is idempotent while a player is live, and moves on only after the player is done", () => {
  const b1 = live();
  const again = start(b1, T0 + 9000, pidAt);
  assert.equal(again.players[0].t0, T0);
  assert.equal(currentIndex(again), 0);
  const done = answer(buzz(b1, T0 + 500, pidAt).board, T0 + 800, "p0", "p0", pidAt).board;
  const next = start(done, T0 + 2000, pidAt);
  assert.equal(currentIndex(next), 1);
  assert.equal(next.players[1].st, "live");
  assert.equal(next.players[1].t0, T0 + 2000);
});

test("a full board of perfect answers scores 20 and completes", () => {
  let board = newBoard();
  let now = T0;
  for (let i = 0; i < 5; i += 1) {
    board = start(board, now, pidAt);
    board = buzz(board, now + 500, pidAt).board;
    board = answer(board, now + 900, `p${i}`, `p${i}`, pidAt).board;
    now += 3000;
  }
  assert.equal(isComplete(board), true);
  assert.equal(score(board), 20);
});

test("score only counts finished players and mixes correct, wrong and timed out", () => {
  let board = start(newBoard(), T0, pidAt);
  board = answer(buzz(board, T0 + 12000, pidAt).board, T0 + 12500, "p0", "p0", pidAt).board; // 3
  board = start(board, T0 + 7000, pidAt);
  board = settle(board, T0 + 7000 + ROUND_MS, pidAt); // 0
  assert.equal(score(board), 3);
  assert.equal(currentIndex(board), 2);
});

test("the engine never mutates its input", () => {
  const b0 = live();
  const snapshot = JSON.stringify(b0);
  buzz(b0, T0 + 1000, pidAt);
  settle(b0, T0 + 99999, pidAt);
  answer(buzz(b0, T0 + 1000, pidAt).board, T0 + 2000, "x", "p0", pidAt);
  assert.equal(JSON.stringify(b0), snapshot);
});

test("a tap the UI showed in a window is never scored below it: the grace covers the trip to the server", () => {
  for (let k = 1; k < 4; k++) {
    // The player taps with 50ms left in window k; the request reaches the server 250ms later.
    const shownValue = valueAt(k * WINDOW_MS - 50);
    const seenByServer = T0 + k * WINDOW_MS - 50 + 250;
    const b = buzz(live(), seenByServer, pidAt).board;
    const res = answer(b, seenByServer + 1000, "p0", "p0", pidAt);
    assert.equal(res.points, shownValue, `window ${k}`);
  }
});

const W = WINDOW_MS;
// A player who buzzes at raw clock `at` and answers wrong straight away (clock resumes at `at - grace`).
function wrongAt(at, guess = "nope") {
  const t = T0 + at;
  const b1 = buzz(live(), t, pidAt).board;
  return answer(b1, t + 400, guess, "p0", pidAt);
}

test("a wrong answer locks the buzzer until the next window, then the player can buzz at that value", () => {
  const res = wrongAt(2000);
  assert.equal(res.correct, false);
  assert.equal(res.ended, false);
  const p = res.board.players[0];
  assert.equal(p.st, "live");
  assert.equal(lockUntil(p), W); // locked until window 2 starts
  // The clock resumed at the 2s the server saw the buzz, so the 10s mark arrives 8s after the wrong answer.
  const resume = T0 + 2400;
  assert.equal(buzz(res.board, resume + 7900, pidAt).reason, "locked-out");
  const again = buzz(res.board, resume + 8100, pidAt);
  assert.equal(again.ok, true);
  assert.equal(again.board.players[0].fe, W); // never reaches back into the locked window
  const fin = answer(again.board, resume + 9000, "p0", "p0", pidAt);
  assert.equal(fin.correct, true);
  assert.equal(fin.points, 3);
});

test("each clue's value is available after a wrong answer in the window before it", () => {
  for (const [at, pointsAfter] of [[2000, 3], [12000, 2], [22000, 1]]) {
    const res = wrongAt(at);
    const lock = lockUntil(res.board.players[0]);
    assert.equal(lock, (Math.floor((at - BUZZ_GRACE_MS) / W) + 1) * W);
    // Wait for the clock to reach the lock, then buzz and answer right.
    const clockNow = lock + 50;
    const resumeAt = T0 + at + 400; // wall time of the wrong answer; the clock read at - grace then
    const wall = resumeAt + (clockNow - at);
    const b = buzz(res.board, wall, pidAt);
    assert.equal(b.ok, true, `buzz after lock at ${at}`);
    assert.equal(answer(b.board, wall + 500, "p0", "p0", pidAt).points, pointsAfter);
  }
});

test("a wrong answer in the final window ends the player at 0 and reveals", () => {
  const res = wrongAt(4 * W + 2000);
  assert.equal(res.correct, false);
  assert.equal(res.ended, true);
  const p = res.board.players[0];
  assert.equal(p.st, "done");
  assert.equal(p.pts, 0);
  assert.equal(p.ok, false);
  assert.equal(p.pid, "p0");
});

test("a wrong answer on the last clue locks until the final window, where a second miss ends the player", () => {
  const first = wrongAt(3 * W + 2000);
  assert.equal(lockUntil(first.board.players[0]), 4 * W);
  const clockAfter = 3 * W + 2000;
  const wall = T0 + 3 * W + 2400 + (4 * W + 100 - clockAfter);
  const b = buzz(first.board, wall, pidAt);
  assert.equal(b.ok, true);
  const second = answer(b.board, wall + 300, "other", "p0", pidAt);
  assert.equal(second.ended, true);
  assert.equal(second.board.players[0].st, "done");
});

test("running out of typing time is a miss: locks until the next window, or ends the player in the final window", () => {
  const b1 = buzz(live(), T0 + 3000, pidAt).board;
  const out = settle(b1, T0 + 3000 + ANSWER_MS + ANSWER_GRACE_MS + 1, pidAt);
  assert.equal(out.players[0].st, "live");
  assert.equal(lockUntil(out.players[0]), W);
  assert.deepEqual(wrongGuesses(out.players[0]), []); // no name was given
  const f1 = buzz(live(), T0 + 4 * W + 1000, pidAt).board;
  const fOut = settle(f1, T0 + 4 * W + 1000 + ANSWER_MS + ANSWER_GRACE_MS + 1, pidAt);
  assert.equal(fOut.players[0].st, "done");
  assert.equal(fOut.players[0].pts, 0);
});

test("wrong guesses are remembered in order", () => {
  const first = wrongAt(2000, "g1");
  assert.deepEqual(wrongGuesses(first.board.players[0]), ["g1"]);
});

test("a board saved under the one-guess rule stays locked for the rest of the round", () => {
  const legacy = { ...live().players[0], w: 1 };
  delete legacy.lk;
  delete legacy.wg;
  assert.equal(lockUntil(legacy), ROUND_MS);
  assert.deepEqual(wrongGuesses(legacy), []);
});
