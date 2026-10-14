import test from "node:test";
import assert from "node:assert/strict";
import { BADGE_DEFS } from "@/lib/account/badges.js";

const def = (slug) => BADGE_DEFS.find((d) => d.slug === slug);
const quiz = (extra) => ({ correct: 5, answered: 10, skipped: 0, ...extra });
const ctx = (extra = {}) => ({
  quizRows: [],
  codemaster: { solved: 0, hasRankedUp: false, rankedUpAt: 67 },
  ...extra,
});

test("Perfect Ten needs 10 correct", () => {
  assert.equal(def("perfect_ten").check(ctx({ quizRows: [quiz({ correct: 9 })] })), false);
  assert.equal(def("perfect_ten").check(ctx({ quizRows: [quiz({ correct: 10 })] })), true);
});

test("No Safety Net needs 10 answered and zero skips", () => {
  const c = (rows) => def("no_safety_net").check(ctx({ quizRows: rows }));
  assert.equal(c([quiz({ answered: 10, skipped: 1 })]), false);
  assert.equal(c([quiz({ answered: 9, skipped: 0 })]), false);
  assert.equal(c([quiz({ answered: 10, skipped: 0, correct: 0 })]), true);
});

test("Codebreaker unlocks at the first rank above the starting rank", () => {
  const c = (hasRankedUp) => def("codebreaker").check(ctx({ codemaster: { solved: 70, hasRankedUp, rankedUpAt: 67 } }));
  assert.equal(c(false), false);
  assert.equal(c(true), true);
});

test("Every League follows the server-side reveal check", () => {
  assert.equal(def("every_league").check(ctx()), false);
  assert.equal(def("every_league").check(ctx({ everyLeague: true })), true);
});

test("Perfect Ten tease shows best score once the member has played", () => {
  assert.equal(def("perfect_ten").progress(ctx()), null);
  assert.deepEqual(def("perfect_ten").progress(ctx({ quizRows: [quiz({ correct: 7 })] })).current, 7);
});
