/**
 * Phase 1 panel engine checks.
 * Run: node --import ./tests/ultima/helpers/register.mjs --test tests/crest/panel-engine.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { nearestArchetype, ARCHETYPES } from "../../the-crest/lib/archetype.js";
import {
  CALIBRATION_ANCHORS,
  LIMITED_BY_EXCLUSIONS_NOTE,
  NEUTRAL_RANGE_NOTE,
  selectMatches,
} from "../../the-crest/lib/select.js";
import {
  displayPercent,
  isNearNeutral,
  rank,
  resetDimensionCache,
} from "../../the-crest/lib/scoring.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const clubs = JSON.parse(
  readFileSync(join(root, "public/crest/clubs.json"), "utf8"),
);

const EQUAL = { Heart: 0.34, Mind: 0.33, Soul: 0.33 };

const ALL_7 = Array(12).fill(7);
const ALL_1 = Array(12).fill(1);
const ALL_4 = Array(12).fill(4);

function bySlug(slug) {
  const club = clubs.find((c) => c.slug === slug);
  assert.ok(club, `missing club ${slug}`);
  return club;
}

const EVERTON = bySlug("everton").vector;

test("reset dimension cache between suites", () => {
  resetDimensionCache();
});

test("displayPercent never falls below 60", () => {
  assert.equal(displayPercent(0.1, 0.1, 0.9), 60);
  assert.equal(displayPercent(0.9, 0.1, 0.9), 97);
  assert.ok(displayPercent(0.5, 0.1, 0.9) >= 60);
});

test("isNearNeutral detects mid vectors", () => {
  assert.equal(isNearNeutral(ALL_4), true);
  assert.equal(isNearNeutral(ALL_7), false);
  assert.equal(isNearNeutral(Array(12).fill(3)), true);
});

test("all-7 lands on suffering / journey / defiance family", () => {
  resetDimensionCache();
  const ranked = rank(ALL_7, clubs, EQUAL);
  const top = ranked[0].club.slug;
  const allowed = new Set(["st-pauli", "roma", "athletic-bilbao"]);
  assert.ok(
    allowed.has(top) ||
      ranked.slice(0, 5).some((r) => allowed.has(r.club.slug)),
    `all-7 top was ${top}; expected St Pauli / Roma / Athletic in top 5`,
  );
  assert.notEqual(top, "real-madrid");
});

test("all-1 lands on success / establishment family", () => {
  resetDimensionCache();
  const ranked = rank(ALL_1, clubs, EQUAL);
  const top = ranked[0].club.slug;
  const allowed = new Set(["real-madrid", "bayern-munich", "al-hilal"]);
  assert.ok(
    allowed.has(top) ||
      ranked.slice(0, 5).some((r) => allowed.has(r.club.slug)),
    `all-1 top was ${top}; expected Real Madrid / Bayern / Al Hilal in top 5`,
  );
});

test("Everton exact vector ranks Everton first and excludes Liverpool as neighbour", () => {
  resetDimensionCache();
  const result = selectMatches(EVERTON, clubs, EQUAL, []);
  assert.equal(result.primary?.club.slug, "everton");
  const neighbourSlugs = result.neighbours.map((n) => n.club.slug);
  assert.ok(!neighbourSlugs.includes("liverpool"), neighbourSlugs.join(","));
  assert.ok((result.primary?.percent ?? 0) >= 60);
  for (const n of result.neighbours) {
    assert.ok(n.percent >= 60);
  }
  assert.equal(result.admireFromAfar?.percent, undefined);
});

test("identical club vector returns that club first via rawFit", () => {
  resetDimensionCache();
  const club = bySlug("st-pauli");
  const ranked = rank(club.vector, clubs, EQUAL);
  assert.equal(ranked[0].club.slug, "st-pauli");
  assert.ok(ranked[0].raw >= ranked[1].raw);
});

test("owned clubs never appear as primary", () => {
  resetDimensionCache();
  const result = selectMatches(EVERTON, clubs, EQUAL, ["everton"]);
  assert.notEqual(result.primary?.club.slug, "everton");
});

test("near-neutral returns calibration anchors with range note", () => {
  resetDimensionCache();
  const result = selectMatches(ALL_4, clubs, EQUAL, []);
  assert.equal(result.note, NEUTRAL_RANGE_NOTE);
  const slugs = [
    result.primary?.club.slug,
    ...result.neighbours.map((n) => n.club.slug),
  ];
  for (const slug of CALIBRATION_ANCHORS) {
    assert.ok(slugs.includes(slug), `missing anchor ${slug}`);
  }
});

test("heavy ownership can surface limited note when diversification relaxes", () => {
  resetDimensionCache();
  // Own most of england-north and force a tight set — still must not throw
  const owned = clubs
    .filter((c) => c.cluster === "england-north")
    .map((c) => c.slug);
  const result = selectMatches(EVERTON, clubs, EQUAL, owned);
  assert.ok(result.primary || result.emptyMessage);
  if (result.note) {
    assert.ok(
      result.note === LIMITED_BY_EXCLUSIONS_NOTE ||
        result.note === NEUTRAL_RANGE_NOTE,
    );
  }
});

test("twelve locked archetypes with three-sentence-capable readings", () => {
  assert.equal(ARCHETYPES.length, 12);
  for (const a of ARCHETYPES) {
    assert.equal(a.vector.length, 12);
    assert.ok(a.reading.length > 40);
    assert.ok(!a.reading.includes("—"));
  }
  const pilgrim = nearestArchetype(bySlug("everton").vector);
  assert.ok(
    pilgrim.name === "The Matchday Pilgrim" ||
      pilgrim.name === "The Faithful Sufferer" ||
      pilgrim.name === "The Romantic Traditionalist",
    pilgrim.name,
  );
});

test("derby exclusions keep Liverpool out of Everton top three", () => {
  resetDimensionCache();
  const result = selectMatches(EVERTON, clubs, EQUAL, []);
  const top3 = [
    result.primary?.club.slug,
    ...result.neighbours.map((n) => n.club.slug),
  ];
  assert.ok(!top3.includes("liverpool"), top3.join(","));
});
