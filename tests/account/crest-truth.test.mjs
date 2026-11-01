import test from "node:test";
import assert from "node:assert/strict";
import { BINARY_CARD_IDS, CARDS } from "@/lib/crest/cards.js";
import { CLUBS } from "@/lib/crest/clubs.js";
import { rankClubs, readFacet } from "@/lib/crest/match.js";
import { buildReport } from "@/lib/crest/report.js";

function club(slug, name, self, others) {
  const mask = Array(12).fill(true);
  return {
    slug,
    name,
    confidence: 1,
    self,
    others,
    selfMask: mask,
    othersMask: mask,
    colourFamilies: [],
    competition: null,
    region: "England",
    group: "England",
  };
}

test("doors weigh more than a like, and life weighs more than a like", () => {
  const door = CARDS.find((card) => card.id === 17);
  const like = CARDS.find((card) => card.id === 6);
  const life = CARDS.find((card) => card.id === 1);
  const situation = CARDS.find((card) => card.id === 24);
  assert.equal(door.weight, 2);
  assert.equal(like.weight, 1);
  assert.equal(life.weight, 1.5);
  assert.equal(situation.weight, 1.5);
  assert.ok(BINARY_CARD_IDS.every((id) => CARDS.find((card) => card.id === id).weight === 2));
});

test("a door outranks a like when the two clubs swap those answers", () => {
  const heavy = Array(12).fill(0);
  const light = Array(12).fill(0);
  heavy[10] = -1;
  heavy[1] = 1;
  light[10] = 1;
  light[1] = -1;
  const clubs = [club("heavy", "Heavy", heavy, heavy), club("light", "Light", light, light)];
  const ranked = rankClubs(
    [
      { cardId: 17, value: -1 },
      { cardId: 6, value: -1 },
    ],
    undefined,
    { clubs },
  );
  assert.equal(ranked[0].club.slug, "heavy");
  assert.ok(ranked[0].score > ranked[1].score);
});

test("a fight is not the middle, and it does not beat an agreed club", () => {
  const calm = Array(12).fill(0);
  const fightSelf = Array(12).fill(0);
  const fightOthers = Array(12).fill(0);
  const agreed = Array(12).fill(0);
  fightSelf[0] = 1;
  fightOthers[0] = -1;
  agreed[0] = -1;
  const clubs = [
    club("middle", "Middle", calm, calm),
    club("fight", "Fight", fightSelf, fightOthers),
    club("agreed", "Agreed", agreed, agreed),
  ];
  const both = rankClubs([{ cardId: 2, value: 0 }], undefined, { clubs });
  const winning = rankClubs([{ cardId: 2, value: -1 }], undefined, { clubs });
  const score = (rows, slug) => rows.find((row) => row.club.slug === slug).score;
  assert.equal(readFacet(clubs[1], 0).contested, true);
  assert.ok(score(both, "middle") >= score(both, "fight"));
  assert.equal(winning[0].club.slug, "agreed");
  assert.ok(score(winning, "agreed") > score(winning, "fight"));
});

test("the report keeps a fight as two voices", () => {
  const answers = CARDS.map((card) => ({
    cardId: card.id,
    value: card.allowBoth ? 0 : -1,
  }));
  const report = buildReport({ answers, group: null, colour: null }, "blend");
  const split = report.facets.filter((facet) => facet.tag === "Split");
  assert.ok(split.length > 0);
  for (const facet of split) {
    assert.equal(facet.them, null);
    assert.ok(facet.self != null && facet.others != null);
    assert.ok(Math.abs(facet.self - facet.others) > 0.6 || Math.sign(facet.self) !== Math.sign(facet.others));
  }
  const selfView = buildReport({ answers, group: null, colour: null }, "self");
  assert.equal(selfView.club.id, report.club.id);
  assert.equal(selfView.facets.some((facet) => facet.tag === "Split"), false);
});

test("Arsenal's own calm and the outside roar are not averaged into one mood", () => {
  const arsenal = CLUBS.find((row) => row.slug === "arsenal");
  const mood = readFacet(arsenal, 1);
  assert.equal(mood.contested, true);
  assert.equal(mood.self, -0.6);
  assert.equal(mood.others, 0.6);
});
