import assert from "node:assert/strict";
import test from "node:test";
import club from "../../data/watch-with/west-ham.json" with { type: "json" };
import { applyElo, drawDeck, expectedPair, samePair } from "../../lib/watch-with/engine.js";
import { isWatchWithHost, watchWithHostAction, watchWithPaths } from "../../lib/watch-with/host.js";

test("the west ham pool keeps four cards inactive", () => {
  assert.equal(club.cards.length, 25);
  const active = club.cards.filter((card) => card.active);
  assert.equal(active.length, 21);
  assert.deepEqual(
    club.cards.filter((card) => !card.active).map((card) => card.name).sort(),
    ["Alfred Hitchcock", "John Cleese", "Matt Damon", "Nick Frost"],
  );
  assert.equal(drawDeck(club.cards, club.deckSize).length, 16);
});

test("inactive cards stay out and the deck stops at 16", () => {
  const cards = [
    ...Array.from({ length: 20 }, (_, index) => ({ id: `a${index}`, active: true })),
    { id: "off", active: false },
  ];
  const deck = drawDeck(cards, 16, () => 0);
  assert.equal(deck.length, 16);
  assert.equal(deck.some((card) => card.id === "off"), false);
});

test("a smaller pool becomes the whole deck", () => {
  const deck = drawDeck([{ id: "a", active: true }, { id: "b", active: true }], 16, () => 0);
  assert.equal(deck.length, 2);
});

test("the challenger walks the deck and a repeat pair is rejected", () => {
  const deck = ["a", "b", "c"];
  assert.deepEqual(expectedPair(deck, 0, null), ["a", "b"]);
  assert.deepEqual(expectedPair(deck, 1, "b"), ["b", "c"]);
  assert.equal(expectedPair(deck, 2, "c"), null);
  assert.equal(samePair(["a", "b"], "b", "a"), true);
  assert.equal(samePair(["b", "c"], "a", "b"), false);
});

test("the watchwith host rewrites the short urls and leaves the api alone", () => {
  assert.equal(isWatchWithHost("watchwith.thereflectivefootball.com"), true);
  assert.equal(isWatchWithHost("watchwith.localhost:4343"), true);
  assert.equal(isWatchWithHost("www.thereflectivefootball.com"), false);
  assert.deepEqual(watchWithHostAction("/"), { type: "rewrite", to: "/watch-with/west-ham" });
  assert.deepEqual(watchWithHostAction("/ranking"), { type: "rewrite", to: "/watch-with/west-ham/ranking" });
  assert.deepEqual(watchWithHostAction("/api/watch-with/west-ham/pick"), { type: "pass" });
  assert.deepEqual(watchWithHostAction("/_next/static/chunk.js"), { type: "pass" });
  assert.deepEqual(watchWithHostAction("/brand/trf-crest-transparent.png"), { type: "pass" });
  assert.deepEqual(watchWithPaths("watchwith.thereflectivefootball.com", "west-ham"), { game: "/", ranking: "/ranking" });
  assert.deepEqual(watchWithPaths("thereflectivefootball.com", "west-ham"), {
    game: "/watch-with/west-ham",
    ranking: "/watch-with/west-ham/ranking",
  });
});

test("an even match moves 12 points at K 24", () => {
  const next = applyElo(1500, 1500, 24);
  assert.equal(next.winnerElo, 1512);
  assert.equal(next.loserElo, 1488);
});
