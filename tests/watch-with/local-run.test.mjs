import assert from "node:assert/strict";
import test from "node:test";
import { applyElo } from "../../lib/watch-with/engine.js";
import { advanceRun } from "../../lib/watch-with/local-run.js";

const deck = [
  { id: "a", name: "A", category: "player", tagline: "one" },
  { id: "b", name: "B", category: "player", tagline: "two" },
  { id: "c", name: "C", category: "player", tagline: "three" },
  { id: "d", name: "D", category: "player", tagline: "four" },
];

test("a local pick advances the incumbent and the next challenger from the deck", () => {
  const start = {
    runId: "r1",
    pick: 1,
    totalPicks: 3,
    done: false,
    incumbentId: null,
    pair: [deck[0], deck[1]],
    deck,
    champion: null,
  };
  const first = advanceRun(start, "b");
  assert.equal(first.incumbentId, "b");
  assert.equal(first.pick, 2);
  assert.deepEqual(first.pair.map((card) => card.id).sort(), ["b", "c"]);
  const second = advanceRun(first, "c");
  assert.equal(second.incumbentId, "c");
  assert.deepEqual(second.pair.map((card) => card.id).sort(), ["c", "d"]);
  const last = advanceRun(second, "c");
  assert.equal(last.done, true);
  assert.equal(last.needsComplete, true);
  assert.equal(last.champion.id, "c");
  assert.equal(last.pair, null);
});

test("Elo at K 24 still moves an even match by 12 points", () => {
  const next = applyElo(1500, 1500, 24);
  assert.equal(next.winnerElo, 1512);
  assert.equal(next.loserElo, 1488);
});

test("Elo rounds to one decimal the same way the SQL function does", () => {
  const next = applyElo(1600, 1400, 24);
  const expected = 1 / (1 + 10 ** ((1400 - 1600) / 400));
  assert.equal(next.winnerElo, Math.round((1600 + 24 * (1 - expected)) * 10) / 10);
  assert.equal(next.loserElo, Math.round((1400 + 24 * (0 - (1 - expected))) * 10) / 10);
});
