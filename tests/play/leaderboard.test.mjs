import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { markPlayer, stageAfter } from "@/lib/play/leaderboard.js";

const rows = [
  { rank: 1, display_name: "Ana", score: 900, correct: 9, answered: 10 },
  { rank: 2, display_name: "Bo", score: 500, correct: 6, answered: 10 },
  { rank: 3, display_name: "Cy", score: 100, correct: 3, answered: 8 },
];
const finish = { summary: { score: 500 }, signedIn: true };

test("See the leaderboard opens the leaderboard and does not reset to the start", () => {
  assert.equal(stageAfter("end", "leaderboard", finish), "leaderboard");
  assert.notEqual(stageAfter("end", "leaderboard", finish), "landing");
  // Without a finished game there is nothing to keep, so the stage is left alone.
  assert.equal(stageAfter("end", "leaderboard", null), "end");
  assert.equal(stageAfter("landing", "leaderboard", finish), "landing");
});

test("Back returns to the same results", () => {
  assert.equal(stageAfter("leaderboard", "back", finish), "end");
  assert.equal(stageAfter("playing", "back", finish), "playing");
});

test("the button is in-app state: no href to /play, which resets on both hosts", () => {
  const end = readFileSync(new URL("../../components/play/EndScreen.js", import.meta.url), "utf8");
  assert.doesNotMatch(end, /href="\/play/);
  assert.match(end, /onClick=\{onLeaderboard\}/);
  const game = readFileSync(new URL("../../components/play/PlayGame.js", import.meta.url), "utf8");
  assert.match(game, /stageAfter\(s, "leaderboard", finish\)/);
});

test("markPlayer highlights an already saved row", () => {
  const out = markPlayer(rows, { score: 500, correct: 6, answered: 10 });
  assert.deepEqual(out.map((r) => r.isYou), [false, true, false]);
  assert.equal(out.length, 3);
});

test("markPlayer slots an unsaved score in at its rank and pushes others down", () => {
  const out = markPlayer(rows, { score: 700, correct: 7, answered: 10 });
  assert.deepEqual(out.map((r) => [r.display_name, r.rank]), [["Ana", 1], ["You", 2], ["Bo", 3], ["Cy", 4]]);
  assert.equal(out[1].isYou, true);
  assert.equal(markPlayer(rows, { score: 5, correct: 0, answered: 5 }).at(-1).rank, 4);
});

test("markPlayer with no game marks nobody and does not mutate", () => {
  const out = markPlayer(rows, null);
  assert.ok(out.every((r) => r.isYou === false));
  assert.equal("isYou" in rows[0], false);
});
