import assert from "node:assert/strict";
import test from "node:test";
import {
  fixtureNeedsPlayerScores,
  mergeScoreQueue,
} from "../../lib/ultima/auto-sync-select.js";

test("FT fixtures with no player rows still need scores", () => {
  assert.equal(fixtureNeedsPlayerScores({ league: "ligue1", status: "FT", stats_final: true }, 0), true);
  assert.equal(fixtureNeedsPlayerScores({ league: "pl", status: "FT", stats_final: false }, 12), true);
  assert.equal(fixtureNeedsPlayerScores({ league: "pl", status: "FT", stats_final: true }, 12), false);
  assert.equal(fixtureNeedsPlayerScores({ league: "pl", status: "LIVE", stats_final: false }, 4), true);
  assert.equal(fixtureNeedsPlayerScores({ league: "pl", status: "NS", stats_final: false }, 0), false);
});

test("the score queue advances and does not rewind", () => {
  const first = mergeScoreQueue([], ["a", "b", "c", "d"]);
  assert.deepEqual(first, ["a", "b", "c", "d"]);
  const afterBatch = first.slice(3);
  const next = mergeScoreQueue(afterBatch, ["d", "e"]);
  assert.deepEqual(next, ["d", "e"]);
  assert.equal(next[0], "d");
});
