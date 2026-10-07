import test from "node:test";
import assert from "node:assert/strict";
import {
  activeCategories, applyAnswer, applyContinue, applySpin, canFinish, canSpin, eligible,
  newState, pickSpin, summarize, wheel, GRACE_MS, SPIN_ALLOWANCE_MS,
} from "@/lib/play/game.js";

const VALUES = [100, 200, 300, 400, 500];
const mk = (cat, value, n, extra = {}) => ({
  id: `${cat}-${value}-${n}`, category: cat, value, clue: `clue ${cat} ${value} ${n}`,
  answer: `ans-${cat}-${value}-${n}`, matchMode: "fuzzy", tags: [`tag-${cat}-${value}-${n}`],
  check: "record", source: "s", acceptedAnswers: [`ans ${cat} ${value} ${n}`.toLowerCase()], ...extra,
});
const bank = (cats) => cats.flatMap((c) => VALUES.flatMap((v) => [0, 1, 2].map((n) => mk(c, v, n))));
const seeded = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

function play(qs, state, correct, now = 1000) {
  const q = pickSpin(qs, state, seeded(state.answered + 3));
  const spun = applySpin(state, q, now, 45);
  const text = correct ? q.acceptedAnswers[0] : "nope";
  return { q, res: applyAnswer(qs, spun, text, now + 1000) };
}

test("active categories need all five values and cap at 8", () => {
  const partial = bank(["A"]).filter((q) => q.value !== 500);
  assert.deepEqual(activeCategories([...partial, ...bank(["B"])]), ["B"]);
  assert.equal(activeCategories(bank(["1", "2", "3", "4", "5", "6", "7", "8", "9"])).length, 8);
});

test("a spin uses up its cell and never repeats it", () => {
  const qs = bank(["A", "B"]);
  let s = newState(qs);
  const seen = new Set();
  for (let i = 0; i < 5; i++) {
    const { q, res } = play(qs, s, true);
    const key = `${q.category}|${q.value}`;
    assert.equal(seen.has(key), false);
    seen.add(key);
    s = res.state;
    if (res.next === "continuePrompt") s = applyContinue(qs, s, true);
  }
});

test("never serves two questions that share a tag or an answer", () => {
  const sameTag = bank(["A"]).map((q) => ({ ...q, tags: ["same"] }));
  const s1 = applySpin(newState(sameTag), sameTag[0], 0, 45);
  assert.equal(eligible(sameTag, { ...s1, pending: null }).length, 0);
  const sameAnswer = bank(["A"]).map((q) => ({ ...q, answer: "same answer" }));
  const s2 = applySpin(newState(sameAnswer), sameAnswer[0], 0, 45);
  assert.equal(eligible(sameAnswer, { ...s2, pending: null }).length, 0);
});

test("cannot spin with a question pending", () => {
  const qs = bank(["A"]);
  assert.equal(canSpin(applySpin(newState(qs), qs[0], 0, 45)), false);
});

test("a category greys out once its five cells are used", () => {
  const qs = bank(["A", "B"]);
  const s = { ...newState(qs), usedCells: VALUES.map((v) => `A|${v}`) };
  assert.deepEqual(wheel(s), [{ name: "A", exhausted: true }, { name: "B", exhausted: false }]);
});

test("correct adds, incorrect subtracts, negatives allowed", () => {
  const qs = bank(["A"]);
  const q = qs.find((x) => x.value === 300);
  const s0 = newState(qs);
  const wrong = applyAnswer(qs, applySpin(s0, q, 0, 45), "nope", 1000);
  assert.equal(wrong.pointsChange, -300);
  assert.equal(wrong.state.score, -300);
  const right = applyAnswer(qs, applySpin(s0, q, 0, 45), q.acceptedAnswers[0], 1000);
  assert.equal(right.state.score, 300);
});

test("past deadline plus grace is a timeout", () => {
  const qs = bank(["A"]);
  const q = qs[0];
  const spun = applySpin(newState(qs), q, 0, 45);
  const edge = 45_000 + SPIN_ALLOWANCE_MS + GRACE_MS;
  const late = applyAnswer(qs, spun, q.acceptedAnswers[0], edge + 1);
  assert.equal(late.timedOut, true);
  assert.equal(late.correct, false);
  assert.equal(applyAnswer(qs, spun, q.acceptedAnswers[0], edge).correct, true);
});

test("a replayed answer is rejected", () => {
  const qs = bank(["A"]);
  const first = applyAnswer(qs, applySpin(newState(qs), qs[0], 0, 45), "x", 1000);
  assert.equal(applyAnswer(qs, first.state, "x", 1000), null);
});

test("asks to continue after question 5 and caps at 10", () => {
  const qs = bank(["A", "B", "C"]);
  let s = newState(qs);
  let next = "spin";
  for (let i = 1; i <= 5; i++) {
    const r = play(qs, s, i % 2 === 0).res;
    s = r.state;
    next = r.next;
  }
  assert.equal(next, "continuePrompt");
  assert.equal(canSpin(s), false);
  s = applyContinue(qs, s, true);
  assert.equal(canSpin(s), true);
  for (let i = 6; i <= 10; i++) {
    const r = play(qs, s, true).res;
    s = r.state;
    next = r.next;
  }
  assert.equal(next, "finished");
  assert.equal(s.answered, 10);
  assert.equal(canSpin(s), false);
});

test("no ends the game and the summary adds up", () => {
  const qs = bank(["A", "B", "C"]);
  let s = newState(qs);
  for (let i = 1; i <= 5; i++) s = play(qs, s, i <= 3).res.state;
  s = applyContinue(qs, s, false);
  assert.equal(s.phase, "finished");
  assert.equal(canFinish(s), true);
  const sum = summarize(s);
  assert.equal(sum.answered, 5);
  assert.equal(sum.correct, 3);
  assert.equal(sum.incorrect, 2);
  assert.equal(sum.averagePoints, Math.round((sum.score / 5) * 10) / 10);
});

test("continue is only valid in the continue phase", () => {
  const qs = bank(["A"]);
  assert.equal(applyContinue(qs, newState(qs), true), null);
});
