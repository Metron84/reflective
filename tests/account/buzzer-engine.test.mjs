import test from "node:test";
import assert from "node:assert/strict";
import {
  ANSWER_GRACE_MS,
  ANSWER_MS,
  BUZZ_GRACE_MS,
  MAX_SCORE,
  ROUND_MS,
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

test("points step 4, 3, 2, 1 every 5 seconds, then the final window is still 1, then 0", () => {
  const cases = [[0, 4], [4999, 4], [5000, 3], [9999, 3], [10000, 2], [14999, 2], [15000, 1], [19999, 1], [20000, 1], [24999, 1], [25000, 0]];
  for (const [ms, pts] of cases) assert.equal(valueAt(ms), pts, `${ms}ms`);
  assert.equal(ROUND_MS, 25000);
  assert.equal(MAX_SCORE, 20);
});

test("a new clue lands every 5 seconds, up to 4", () => {
  assert.deepEqual([0, 4999, 5000, 10000, 15000, 24000].map(cluesAt), [1, 1, 2, 3, 4, 4]);
});

test("a correct answer scores the value frozen at the tap", () => {
  const b0 = live();
  const { board: b1, ok } = buzz(b0, T0 + 7200 + BUZZ_GRACE_MS, pidAt); // raw 7.5s, 7.2s after grace
  assert.equal(ok, true);
  const res = answer(b1, T0 + 9000, "p0", "p0", pidAt);
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
  assert.equal(valueAt(elapsed(p, T0 + 12000)), 3);
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

test("a round nobody answers ends at 25 seconds with 0 points", () => {
  const b = settle(live(), T0 + ROUND_MS, pidAt);
  assert.equal(b.players[0].st, "done");
  assert.equal(b.players[0].pts, 0);
  assert.equal(b.players[0].ok, false);
  assert.equal(b.players[0].pid, "p0");
});

test("a buzz inside the final window scores 1", () => {
  const b1 = buzz(live(), T0 + 22000, pidAt).board;
  assert.equal(answer(b1, T0 + 23000, "p0", "p0", pidAt).points, 1);
});

test("a buzz after the round has run out is refused", () => {
  const res = buzz(live(), T0 + ROUND_MS + 10, pidAt);
  assert.equal(res.ok, false);
  assert.equal(res.board.players[0].st, "done");
});

test("the grace takes a little off the clock so a laggy tap near a boundary keeps the higher value", () => {
  // The player tapped at 4.9s but the request landed at 5.1s.
  const b1 = buzz(live(), T0 + 5100, pidAt).board;
  assert.equal(answer(b1, T0 + 5200, "p0", "p0", pidAt).points, 4);
  // A tap well past the boundary is still 3.
  const b2 = buzz(live(), T0 + 5600, pidAt).board;
  assert.equal(answer(b2, T0 + 5700, "p0", "p0", pidAt).points, 3);
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
  board = answer(buzz(board, T0 + 6000, pidAt).board, T0 + 6500, "p0", "p0", pidAt).board; // 3
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
