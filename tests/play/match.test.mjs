import test from "node:test";
import assert from "node:assert/strict";
import { isCorrect, normalize } from "@/lib/play/match.js";

const fuzzy = (...a) => ({ matchMode: "fuzzy", acceptedAnswers: a });
const strict = (...a) => ({ matchMode: "strict", acceptedAnswers: a });
const drogba = fuzzy("didier drogba", "drogba");

test("normalize strips accents, punctuation and a leading the", () => {
  assert.equal(normalize("  The Atlético!! "), "atletico");
  assert.equal(normalize("2013/14"), "2013 14");
  assert.equal(normalize("Stoke-on/Trent"), "stoke on trent");
});

test("fuzzy accepts a surname, punctuation and a phrase inside a longer input", () => {
  assert.equal(isCorrect("drogba", drogba), true);
  assert.equal(isCorrect("Didier Drogba!", drogba), true);
  assert.equal(isCorrect("it was Didier Drogba", drogba), true);
});

test("fuzzy rejects kain for kane", () => {
  assert.equal(isCorrect("kain", fuzzy("kane")), false);
  assert.equal(isCorrect("kane", fuzzy("kane")), true);
});

test("fuzzy tolerance scales with length", () => {
  assert.equal(isCorrect("lampad", fuzzy("lampard")), true);
  assert.equal(isCorrect("stamford brigde", fuzzy("stamford bridge")), true);
  assert.equal(isCorrect("stamfrd bridge", fuzzy("stamford bridge")), true);
  assert.equal(isCorrect("stanfrd brigd", fuzzy("stamford bridge")), false);
});

test("fuzzy matches an accented Atletico and drops a leading the", () => {
  assert.equal(isCorrect("Atlético Madrid", fuzzy("atletico madrid")), true);
  assert.equal(isCorrect("bridge", fuzzy("the bridge")), true);
});

test("empty and wrong answers fail", () => {
  assert.equal(isCorrect("", drogba), false);
  assert.equal(isCorrect("lampard", drogba), false);
});

test("strict accepts seasons and years, rejects near misses", () => {
  const season = strict("2013-14", "2013/14", "2014");
  assert.equal(isCorrect("2013/14", season), true);
  assert.equal(isCorrect("2014", season), true);
  assert.equal(isCorrect("in 2014", season), true);
  assert.equal(isCorrect("2015", season), false);
  assert.equal(isCorrect("2013", season), false);
  assert.equal(isCorrect("it was 2014", season), false);
});

test("strict accepts 80s for the 1980s", () => {
  const dec = strict("1980s", "the 1980s", "80s");
  for (const t of ["80s", "the 80s", "1980s"]) assert.equal(isCorrect(t, dec), true, t);
  assert.equal(isCorrect("90s", dec), false);
});

test("answerGroups count distinct groups", () => {
  const spec = {
    matchMode: "fuzzy",
    answerGroups: [["bobby moore", "moore"], ["geoff hurst", "hurst"], ["martin peters", "peters"]],
    requiredCount: 2,
  };
  for (const t of ["Moore and Hurst", "Moore, Peters", "Bobby Moore & Geoff Hurst", "moore hurst peters"]) {
    assert.equal(isCorrect(t, spec), true, t);
  }
  for (const t of ["Moore", "Bobby Moore, Moore", "Moore and Lampard"]) {
    assert.equal(isCorrect(t, spec), false, t);
  }
});
