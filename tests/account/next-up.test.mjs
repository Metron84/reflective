import test from "node:test";
import assert from "node:assert/strict";
import { pickNextUp } from "@/lib/account/next-up.js";

const base = { quizOpen: false, unrevealed: 0, codemasterInProgress: false };

test("open daily spin wins over everything", () => {
  const n = pickNextUp({ quizOpen: true, unrevealed: 5, codemasterInProgress: true });
  assert.equal(n.title, "Your daily spin is still open");
  assert.equal(n.href, "/play");
});

test("hidden leagues come second and scroll to the Crest tile", () => {
  const n = pickNextUp({ ...base, unrevealed: 4, codemasterInProgress: true });
  assert.equal(n.title, "4 leagues still hiding your club");
  assert.equal(n.scrollTo, "crest-tile");
  assert.equal(pickNextUp({ ...base, unrevealed: 1 }).title, "1 league still hiding your club");
});

test("codemaster in progress is third", () => {
  const n = pickNextUp({ ...base, codemasterInProgress: true });
  assert.equal(n.title, "Your next code is waiting");
  assert.equal(n.href, "/codemaster");
});

test("fallback spins the wheel", () => {
  const n = pickNextUp(base);
  assert.equal(n.title, "Spin the wheel");
  assert.equal(n.href, "/play");
});
