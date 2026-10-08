import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { confettiPieces, nextStreak, roundLabel, streakBadge } from "@/lib/play/feedback.js";

test("round label counts the round being played and caps at the last", () => {
  assert.equal(roundLabel(0, 10), "ROUND 1 OF 10");
  assert.equal(roundLabel(1, 10), "ROUND 2 OF 10");
  assert.equal(roundLabel(10, 10), "ROUND 10 OF 10");
});

test("streak badge shows from two correct in a row and resets on a miss", () => {
  let s = 0;
  const seen = [];
  for (const c of [true, true, true, false, true]) {
    s = nextStreak(s, c);
    seen.push(streakBadge(s));
  }
  assert.deepEqual(seen, [null, "x2", "x3", null, null]);
});

test("confetti is a gold burst and stable between renders", () => {
  const a = confettiPieces();
  assert.deepEqual(a, confettiPieces());
  assert.ok(a.length >= 20 && a.length <= 40);
  assert.ok(a.filter((p) => p.color === "#F5C451").length > a.length / 2);
});

test("reduced motion removes confetti and shake, and keeps flashes", () => {
  const css = readFileSync(new URL("../../components/play/feedback.module.css", import.meta.url), "utf8");
  const block = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(block, /\.confetti[\s\S]*display:\s*none/);
  assert.match(block, /\.shake[\s\S]*animation:\s*none/);
  const js = readFileSync(new URL("../../components/play/Feedback.js", import.meta.url), "utf8");
  assert.match(js, /if \(good \|\| reducedMotion\(\)\) return;/);
  assert.match(css, /\.flash\s*\{[\s\S]*animation:\s*flash 300ms/);
});
