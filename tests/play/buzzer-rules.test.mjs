// Board-level tests for The Guesser buzzer: whole five-player boards played through the server logic
// with a fake clock, asserting the score out of 20 and each player's result.
import test from "node:test";
import assert from "node:assert/strict";
import { ROUND_MS } from "@/lib/guesser/buzzer/engine.js";
import { nameFor } from "@/lib/guesser/buzzer/pool.js";
import { ANSWER_GRACE_MS, ANSWER_MS, BOARD, WINDOW_MS, WRONGS, newGame, perfectFrom, pointsOf } from "./helpers/buzzer-harness.mjs";

const W = WINDOW_MS;
const nameOf = (id) => nameFor(id);

function expectBoard(body, { score, points, correct }) {
  assert.equal(body.status, "complete");
  assert.equal(body.maxScore, 20);
  assert.equal(body.score, score);
  assert.deepEqual(pointsOf(body), points);
  if (correct) assert.deepEqual(body.players.map((p) => p.correct), correct);
  assert.ok(body.players.every((p) => p.state === "done" && p.name));
  assert.equal(body.current, null);
}

test("1. a perfect board, correct on clue 1 for all five, scores 20", async () => {
  const g = newGame();
  const body = await perfectFrom(g, 1);
  expectBoard(body, { score: 20, points: [4, 4, 4, 4, 4], correct: [true, true, true, true, true] });
  assert.deepEqual(body.players.map((p) => p.name), BOARD.map(nameOf));
  // The score is saved with the board.
  assert.equal(g.db.rows.length, 1);
  assert.equal(g.db.rows[0].score, 20);
  assert.equal(g.db.rows[0].solved, true);
});

test("2. wrong on clue 1, correct after the clue 2 unlock, scores 3 for that player", async () => {
  const g = newGame();
  await g.start();
  g.rawAt(2000);
  await g.buzz();
  const wrong = await g.answerWrong(WRONGS[0]);
  assert.equal(wrong.outcome, "wrong");
  assert.equal(wrong.current.lockedOut, true);
  assert.equal(wrong.current.clues.length, 1);
  const open = await g.unlock();
  assert.equal(open.current.lockedOut, false);
  assert.equal(open.current.clues.length, 2); // clue 2 has landed
  const frozen = await g.buzz();
  assert.equal(frozen.outcome, "frozen");
  assert.equal(frozen.current.value, 3);
  const right = await g.answerRight();
  assert.equal(right.outcome, "correct");
  assert.equal(right.points, 3);
  const body = await perfectFrom(g, 2);
  expectBoard(body, { score: 19, points: [3, 4, 4, 4, 4] });
});

test("3. wrong on clues 1, 2 and 3, correct on clue 4, scores 1", async () => {
  const g = newGame();
  await g.start();
  g.rawAt(2000);
  await g.buzz();
  let r = await g.answerWrong(WRONGS[0]);
  for (const [i, expectValue] of [[1, 3], [2, 2]]) {
    assert.equal(r.outcome, "wrong");
    await g.unlock();
    const f = await g.buzz();
    assert.equal(f.current.value, expectValue);
    assert.equal(f.current.clues.length, i + 1);
    r = await g.answerWrong(WRONGS[i]);
  }
  assert.equal(r.outcome, "wrong");
  assert.deepEqual(r.current.wrong, [WRONGS[0], WRONGS[1], WRONGS[2]].map(nameOf));
  await g.unlock();
  const last = await g.buzz();
  assert.equal(last.current.clues.length, 4);
  assert.equal(last.current.value, 1);
  const right = await g.answerRight();
  assert.equal(right.points, 1);
  expectBoard(await perfectFrom(g, 2), { score: 17, points: [1, 4, 4, 4, 4] });
});

test("4. wrong on the last clue locks until the final window; correct there scores 1", async () => {
  const g = newGame();
  await g.start();
  g.rawAt(3 * W + 1000);
  const first = await g.buzz();
  assert.equal(first.current.clues.length, 4);
  const wrong = await g.answerWrong(WRONGS[0]);
  assert.equal(wrong.current.lockedOut, true);
  assert.equal(wrong.current.unlocksAtMs, 4 * W); // the final window, there is no clue 5
  assert.equal((await g.buzz()).outcome, "locked-out");
  const open = await g.unlock();
  assert.equal(open.current.lockedOut, false);
  assert.equal(open.current.clues.length, 4);
  const f = await g.buzz();
  assert.equal(f.current.value, 1);
  const right = await g.answerRight();
  assert.equal(right.points, 1);
  expectBoard(await perfectFrom(g, 2), { score: 17, points: [1, 4, 4, 4, 4] });
});

test("5. wrong in the final window ends the player at 0, reveals, and the board moves on", async () => {
  const g = newGame();
  await g.start();
  g.rawAt(4 * W + 2000);
  await g.buzz();
  const wrong = await g.answerWrong(WRONGS[0]);
  assert.equal(wrong.outcome, "wrong");
  assert.equal(wrong.current, null);
  assert.equal(wrong.status, "between");
  assert.equal(wrong.index, 2);
  assert.equal(wrong.players[0].state, "done");
  assert.equal(wrong.players[0].points, 0);
  assert.equal(wrong.players[0].correct, false);
  assert.equal(wrong.players[0].name, nameOf(BOARD[0]));
  // The next player starts as normal.
  const next = await g.start();
  assert.equal(next.status, "live");
  assert.equal(next.current.n, 2);
  g.rawAt(1000);
  await g.buzz();
  await g.answerRight();
  expectBoard(await perfectFrom(g, 3), { score: 16, points: [0, 4, 4, 4, 4], correct: [false, true, true, true, true] });
});

test("6a. a typing time-out in a normal window behaves exactly like a wrong answer", async () => {
  const viaWrong = newGame();
  await viaWrong.start();
  viaWrong.rawAt(2000);
  await viaWrong.buzz();
  const w = await viaWrong.answerWrong(WRONGS[0]);

  const viaTimeout = newGame();
  await viaTimeout.start();
  viaTimeout.rawAt(2000);
  await viaTimeout.buzz();
  viaTimeout.wait(ANSWER_MS + ANSWER_GRACE_MS + 1);
  const t = await viaTimeout.state();

  for (const body of [w, t]) {
    assert.equal(body.status, "live");
    assert.equal(body.players[0].state, "live");
    assert.equal(body.current.lockedOut, true);
    assert.equal(body.current.frozen, false);
    assert.equal(body.current.unlocksAtMs, W);
    assert.equal(body.current.clues.length, 1);
    assert.equal(body.score, 0);
  }
  assert.deepEqual(w.current.wrong, [nameOf(WRONGS[0])]);
  assert.deepEqual(t.current.wrong, []); // no name was given
  // The same way back in: unlock, buzz at the new value, answer.
  await viaTimeout.unlock();
  const f = await viaTimeout.buzz();
  assert.equal(f.current.value, 3);
  assert.equal((await viaTimeout.answerRight()).points, 3);
  expectBoard(await perfectFrom(viaTimeout, 2), { score: 19, points: [3, 4, 4, 4, 4] });
});

test("6b. a typing time-out in the final window ends the player at 0 exactly like a wrong answer", async () => {
  const viaWrong = newGame();
  await viaWrong.start();
  viaWrong.rawAt(4 * W + 2000);
  await viaWrong.buzz();
  const w = await viaWrong.answerWrong(WRONGS[0]);

  const viaTimeout = newGame();
  await viaTimeout.start();
  viaTimeout.rawAt(4 * W + 2000);
  await viaTimeout.buzz();
  viaTimeout.wait(ANSWER_MS + ANSWER_GRACE_MS + 1);
  const t = await viaTimeout.state();

  for (const body of [w, t]) {
    assert.equal(body.status, "between");
    assert.equal(body.current, null);
    assert.equal(body.index, 2);
    assert.deepEqual(body.players[0], { n: 1, state: "done", points: 0, correct: false, name: nameOf(BOARD[0]) });
  }
  expectBoard(await perfectFrom(viaTimeout, 2), { score: 16, points: [0, 4, 4, 4, 4] });
});

test("7. a buzz while locked is refused, and an answer without a fresh buzz changes nothing", async () => {
  const g = newGame();
  await g.start();
  g.rawAt(2000);
  await g.buzz();
  await g.answerWrong(WRONGS[0]);
  const before = await g.state();
  const revBefore = g.db.rows[0].guesses.rev;

  const refused = await g.buzz();
  assert.equal(refused.outcome, "locked-out");
  assert.equal(refused.current.frozen, false);

  // Even the right answer is refused without a buzz: the same window, a second answer.
  const sneaky = await g.call("answer", { personId: BOARD[0] });
  assert.equal(sneaky.outcome, "rejected");
  assert.equal(sneaky.score, 0);
  const textual = await g.call("answer", { text: nameOf(BOARD[0]) });
  assert.equal(textual.outcome, "rejected");

  const after = await g.state();
  assert.deepEqual(after, before);
  assert.equal(g.db.rows[0].guesses.rev, revBefore); // nothing was written
  // The board still plays out normally afterwards.
  await g.unlock();
  await g.buzz();
  assert.equal((await g.answerRight()).points, 3);
  expectBoard(await perfectFrom(g, 2), { score: 19, points: [3, 4, 4, 4, 4] });
});

test("8. the same wrong name twice does not use up the next buzz", async () => {
  const g = newGame();
  await g.start();
  g.rawAt(2000);
  await g.buzz();
  await g.answerWrong(WRONGS[0]);
  await g.unlock();
  await g.buzz();

  const byId = await g.answerWrong(WRONGS[0]);
  assert.equal(byId.outcome, "repeat");
  assert.equal(byId.current.frozen, true);
  assert.deepEqual(byId.current.wrong, [nameOf(WRONGS[0])]);
  const byText = await g.answer({ text: nameOf(WRONGS[0]) }, 200);
  assert.equal(byText.outcome, "repeat");
  assert.equal(byText.current.frozen, true);

  // A different wrong name is a real miss: locks again, now two names listed.
  const second = await g.answerWrong(WRONGS[1]);
  assert.equal(second.outcome, "wrong");
  assert.deepEqual(second.current.wrong, [WRONGS[0], WRONGS[1]].map(nameOf));
  await g.unlock();
  await g.buzz();
  assert.equal((await g.answerRight()).points, 2);
  expectBoard(await perfectFrom(g, 2), { score: 18, points: [2, 4, 4, 4, 4] });
});

test("9. a buzz near the end of a window, a wrong answer and the unlock cannot award the locked window's points", async () => {
  const g = newGame();
  // Player 1: buzz at 9.8s (window 1, 4 points on offer), wrong after 0.3s of typing.
  await g.start();
  g.rawAt(W - 200);
  await g.buzz();
  const wrong = await g.answer({ personId: WRONGS[0] }, 300);
  assert.equal(wrong.current.lockedOut, true);
  assert.equal(wrong.current.unlocksInMs, 200); // the clock resumed at the 9.8s the server saw the buzz
  g.wait(100);
  assert.equal((await g.buzz()).outcome, "locked-out"); // 9.9s
  g.wait(150);
  const open = await g.buzz(); // 10.05s, with the tap grace taken off the clock
  assert.equal(open.outcome, "frozen");
  assert.equal(open.current.value, 3); // never 4
  const right = await g.answerRight();
  assert.equal(right.points, 3);

  // Player 2: the same at the next boundary, 19.9s.
  await g.start();
  g.rawAt(2 * W - 100);
  await g.buzz();
  const wrong2 = await g.answer({ personId: WRONGS[1] }, 300);
  assert.equal(wrong2.current.unlocksInMs, 100);
  g.wait(120);
  const open2 = await g.buzz();
  assert.equal(open2.current.value, 2); // never 3
  assert.equal((await g.answerRight()).points, 2);

  expectBoard(await perfectFrom(g, 3), { score: 17, points: [3, 2, 4, 4, 4] });
});

test("10a. matching: 'Maradonna' is accepted for Diego Maradona", async () => {
  const g = newGame();
  await g.start();
  g.rawAt(1000);
  await g.buzz();
  const res = await g.answer({ text: "Maradonna" });
  assert.equal(res.outcome, "correct");
  assert.equal(res.points, 4);
  expectBoard(await perfectFrom(g, 2), { score: 20, points: [4, 4, 4, 4, 4] });
});

test("10b. matching: 'Xabi' is not accepted for Xavi", async () => {
  const g = newGame({ ids: ["xavi", ...BOARD.slice(1)] });
  await g.start();
  g.rawAt(1000);
  await g.buzz();
  const xabi = await g.answer({ text: "Xabi" });
  assert.notEqual(xabi.outcome, "correct");
  assert.equal(xabi.score, 0);
  // The full other name is a plain wrong answer, and Xavi himself still scores after the unlock.
  const full = await g.answer({ text: "Xabi Alonso" });
  assert.equal(full.outcome, "wrong");
  await g.unlock();
  await g.buzz();
  assert.equal((await g.answer({ text: "Xavi" })).points, 3);
  expectBoard(await perfectFrom(g, 2), { score: 19, points: [3, 4, 4, 4, 4] });
});

test("10c. matching: a two-letter swap is rejected and does not use up the guess", async () => {
  const g = newGame();
  await g.start();
  g.rawAt(1000);
  await g.buzz();
  const swap = await g.answer({ text: "Maradnoa" }); // a swap is two edits
  assert.equal(swap.outcome, "unknown");
  assert.equal(swap.current.frozen, true);
  assert.deepEqual(swap.current.wrong, []);
  const ok = await g.answer({ text: "Maradona" });
  assert.equal(ok.points, 4);
  expectBoard(await perfectFrom(g, 2), { score: 20, points: [4, 4, 4, 4, 4] });
});

test("10d. matching: a typo that is also close to another player counts as the answer", async () => {
  // "Silla" is one letter from both Milla and Villa. The answer is Milla, so it is Milla.
  const g = newGame({ ids: ["roger-milla", ...BOARD.slice(1)] });
  await g.start();
  g.rawAt(1000);
  await g.buzz();
  const res = await g.answer({ text: "Silla" });
  assert.equal(res.outcome, "correct");
  assert.equal(res.points, 4);
  expectBoard(await perfectFrom(g, 2), { score: 20, points: [4, 4, 4, 4, 4] });
});

test("10e. matching: two near neighbours that are not the answer trigger the pick list", async () => {
  const g = newGame(); // the answer is Maradona
  await g.start();
  g.rawAt(1000);
  await g.buzz();
  const res = await g.answer({ text: "Silla" });
  assert.equal(res.outcome, "ambiguous");
  assert.ok(res.options.includes("roger-milla") && res.options.includes("david-villa"));
  assert.ok(!JSON.stringify(res).includes(nameOf(BOARD[0]))); // nothing revealed
  assert.equal(res.current.frozen, true); // the guess was not used
  assert.deepEqual(res.current.wrong, []);
  // Picking one from the list is a real answer.
  const pick = await g.answerWrong("david-villa");
  assert.equal(pick.outcome, "wrong");
  await g.unlock();
  await g.buzz();
  assert.equal((await g.answerRight()).points, 3);
  expectBoard(await perfectFrom(g, 2), { score: 19, points: [3, 4, 4, 4, 4] });
});

test("11. a board saved under the one-guess rule stays locked for the rest of the round", async () => {
  const g = newGame();
  const legacy = () => ({ st: "pending", t0: 0, pz: 0, bz: null, fe: 0, w: 0, pts: 0, ok: false, pid: null, g: null });
  const now = g.clock.t;
  g.db.rows.push({
    id: 500, user_id: null, session_hash: "sess-1", puzzle_date: "2026-10-15", mode: "buzzer",
    solved: false, attempts: 0, score: 0,
    guesses: {
      v: 1, rev: 3,
      // Player 1 buzzed and answered wrong under the old rule: w = 1, no lk or wg fields.
      players: [{ ...legacy(), st: "live", t0: now - 12_000, pz: 1_000, w: 1, g: "xavi" }, ...Array.from({ length: 4 }, legacy)],
    },
  });
  g.t0 = now - 12_000 + 1_000; // the running clock reads 0 at this wall time (t0 + pz), so it reads 11s now
  const s = await g.state();
  assert.equal(s.current.lockedOut, true);
  assert.equal(s.current.unlocksAtMs, ROUND_MS);
  assert.deepEqual(s.current.wrong, []);
  // Running clock now reads 11s. Still locked at 11s, 30s and 49s.
  for (const raw of [11_000, 30_000, 49_000]) {
    g.clock.t = g.t0 + raw;
    assert.equal((await g.buzz()).outcome, "locked-out", `raw ${raw}`);
  }
  // The round closes at 50s with 0 points and a reveal.
  g.clock.t = g.t0 + ROUND_MS + 1;
  const closed = await g.state();
  assert.equal(closed.players[0].state, "done");
  assert.equal(closed.players[0].points, 0);
  assert.equal(closed.players[0].name, nameOf(BOARD[0]));
  assert.equal(closed.index, 2);
  const body = await perfectFrom(g, 2);
  expectBoard(body, { score: 16, points: [0, 4, 4, 4, 4] });
});

test("12. a full mixed board totals the expected score and saves it to plays", async () => {
  const g = newGame();

  // Player 1: perfect, 4.
  await g.perfect();

  // Player 2: one relock. Wrong at 2s, right after the clue 2 unlock, 3.
  await g.start();
  g.rawAt(2000);
  await g.buzz();
  await g.answerWrong(WRONGS[0]);
  await g.unlock();
  await g.buzz();
  assert.equal((await g.answerRight()).points, 3);

  // Player 3: a miss in the final window, 0 and a reveal.
  await g.start();
  g.rawAt(4 * W + 3000);
  await g.buzz();
  const miss = await g.answerWrong(WRONGS[1]);
  assert.equal(miss.players[2].state, "done");
  assert.equal(miss.players[2].points, 0);

  // Player 4: a time-out in window 2, right after the clue 3 unlock, 2.
  await g.start();
  g.rawAt(W + 2000);
  await g.buzz();
  g.wait(ANSWER_MS + ANSWER_GRACE_MS + 1);
  const out = await g.state();
  assert.equal(out.current.lockedOut, true);
  await g.unlock();
  await g.buzz();
  assert.equal((await g.answerRight()).points, 2);

  // Player 5: a typo of the name, accepted on clue 1, 4.
  await g.start();
  g.rawAt(1000);
  await g.buzz();
  const typo = await g.answer({ text: `${nameOf(BOARD[4])}z` });
  assert.equal(typo.outcome, "correct");
  assert.equal(typo.points, 4);

  const body = await g.state();
  expectBoard(body, { score: 13, points: [4, 3, 0, 2, 4], correct: [true, true, false, true, true] });

  const row = g.db.rows[0];
  assert.equal(g.db.rows.length, 1);
  assert.equal(row.score, 13);
  assert.equal(row.solved, true);
  assert.equal(row.attempts, 5);
  assert.deepEqual(row.guesses.players.map((p) => p.pts), [4, 3, 0, 2, 4]);
  assert.deepEqual(row.guesses.players.map((p) => p.ok), [true, true, false, true, true]);
});
