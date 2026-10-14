import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CARDS, BINARY_CARD_IDS } from "@/lib/crest/cards.js";
import { CLUBS, CREST_GROUPS } from "@/lib/crest/clubs.js";
import { STAKES } from "@/lib/crest/stakes.js";
import { DEFAULT_ALPHA, arrivalSummary, bestClubPerLeague, lockLeaguePicks } from "@/lib/crest/match.js";
import { RIVALS, areRivals, rivalsOf } from "@/lib/crest/rivals.js";

const bySlug = Object.fromEntries(CLUBS.map((c) => [c.slug, c]));

test("rivals.json: every pair is two-way, between real Crest clubs, never a club with itself", () => {
  for (const [slug, list] of Object.entries(RIVALS)) {
    assert.ok(bySlug[slug], `${slug} is not a Crest club`);
    assert.ok(list.length > 0, `${slug} has an empty list`);
    assert.equal(new Set(list).size, list.length, `${slug} lists a rival twice`);
    for (const rival of list) {
      assert.notEqual(rival, slug, `${slug} is its own rival`);
      assert.ok(bySlug[rival], `${rival} (rival of ${slug}) is not a Crest club`);
      assert.ok((RIVALS[rival] ?? []).includes(slug), `${slug} lists ${rival} but ${rival} does not list ${slug}`);
    }
  }
});

test("rivals.json holds every pair from the supplied list, both ways", () => {
  const lines = readFileSync(new URL("../../scripts/crest/rival-pairs.txt", import.meta.url), "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  assert.ok(lines.length >= 80);
  for (const line of lines) {
    const [a, b] = line.split("|");
    assert.ok(bySlug[a] && bySlug[b], `${line} names a club that is not in the Crest`);
    assert.ok(rivalsOf(a).includes(b), `${a} -> ${b}`);
    assert.ok(rivalsOf(b).includes(a), `${b} -> ${a}`);
  }
});

test("the snapshot mappings landed: psg and nurnberg, not the long slugs", () => {
  assert.ok(rivalsOf("marseille").includes("psg"));
  assert.ok(!Object.values(RIVALS).flat().includes("paris-saint-germain"));
  assert.ok(!Object.values(RIVALS).flat().includes("1-fc-nurnberg"));
  assert.ok(areRivals("nurnberg", "greuther-furth"));
});

const pick = (slug, probability) => ({ club: bySlug[slug], probability });

test("Spurs and West Ham never both appear: the stronger league pick locks first", () => {
  const leagues = [
    { competition: "Premier League", label: "Premier League", candidates: [pick("tottenham-hotspur", 0.7), pick("newcastle-united", 0.3)] },
    { competition: "Championship", label: "Championship", candidates: [pick("west-ham-united", 0.5), pick("watford", 0.3), pick("cardiff-city", 0.2)] },
  ];
  const rows = lockLeaguePicks(leagues, { home: null, rivals: RIVALS });
  assert.deepEqual(rows.map((r) => r.club.slug), ["tottenham-hotspur", "watford"]);

  // Flip the strengths: West Ham is the stronger pick, so Spurs gives way.
  const flipped = [
    { ...leagues[0], candidates: [pick("tottenham-hotspur", 0.4), pick("newcastle-united", 0.35), pick("bournemouth", 0.25)] },
    { ...leagues[1], candidates: [pick("west-ham-united", 0.8), pick("watford", 0.2)] },
  ];
  const rows2 = lockLeaguePicks(flipped, { home: null, rivals: RIVALS });
  assert.deepEqual(rows2.map((r) => r.club.slug), ["newcastle-united", "west-ham-united"]);
});

test("rivals of home are skipped, and a league left with only rivals is left out", () => {
  const home = bySlug["tottenham-hotspur"];
  const leagues = [
    { competition: "Premier League", label: "PL", candidates: [pick("arsenal", 0.9), pick("tottenham-hotspur", 0.1)] },
    { competition: "Championship", label: "Ch", candidates: [pick("west-ham-united", 0.6), pick("millwall", 0.4)] },
    { competition: "League One", label: "L1", candidates: [pick("bradford-city", 0.9)] },
  ];
  // Home takes the Premier League row. West Ham is home's rival, so the Championship takes
  // Millwall (a rival of West Ham, not of Spurs). Bradford is unrelated.
  const rows = lockLeaguePicks(leagues, { home, rivals: RIVALS });
  assert.deepEqual(rows.map((r) => r.club.slug), ["tottenham-hotspur", "millwall", "bradford-city"]);

  const onlyRivals = [
    { competition: "Championship", label: "Ch", candidates: [pick("west-ham-united", 0.6), pick("chelsea", 0.4)] },
    { competition: "League One", label: "L1", candidates: [pick("bradford-city", 0.9)] },
  ];
  const left = lockLeaguePicks(onlyRivals, { home, rivals: RIVALS });
  assert.deepEqual(left.map((r) => r.club.slug), ["bradford-city"]);
});

test("a home club's rival never appears; home takes its own league's row", () => {
  const home = bySlug["arsenal"];
  const leagues = [
    {
      competition: "Premier League",
      label: "Premier League",
      candidates: [pick("tottenham-hotspur", 0.5), pick("arsenal", 0.3), pick("chelsea", 0.2)],
    },
    { competition: "Championship", label: "Championship", candidates: [pick("west-ham-united", 0.9), pick("watford", 0.1)] },
  ];
  const rows = lockLeaguePicks(leagues, { home, rivals: RIVALS });
  const slugs = rows.map((r) => r.club.slug);
  assert.deepEqual(slugs, ["arsenal", "west-ham-united"]);
  for (const rival of rivalsOf("arsenal")) assert.ok(!slugs.includes(rival), `${rival} appeared beside Arsenal`);
});

test("without a rivals map nothing is excluded", () => {
  const leagues = [
    { competition: "Premier League", label: "PL", candidates: [pick("tottenham-hotspur", 0.7)] },
    { competition: "Championship", label: "Ch", candidates: [pick("west-ham-united", 0.5)] },
  ];
  assert.equal(lockLeaguePicks(leagues, {}).length, 2);
});

function seeded(seed) {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
}

test("real hands: no two rows are rivals, no row is a rival of home, one row per league", () => {
  const rnd = seeded(20261015);
  const scopes = [null, ...CREST_GROUPS];
  const stakes = [null, ...STAKES.map((x) => x.id)];
  for (let i = 0; i < 200; i += 1) {
    const hand = CARDS.map((c) => ({
      cardId: c.id,
      value: BINARY_CARD_IDS.includes(c.id) ? (rnd() < 0.5 ? -1 : 1) : [1, -1, 0][Math.floor(rnd() * 3)],
    }));
    const scope = scopes[Math.floor(rnd() * scopes.length)];
    const stake = stakes[Math.floor(rnd() * stakes.length)];
    const home = arrivalSummary(hand, DEFAULT_ALPHA, { group: scope, stake }).club;
    const rows = bestClubPerLeague(hand, { stake, scope, home: home.slug, rivals: RIVALS });
    const slugs = rows.map((r) => r.club.slug);

    assert.equal(new Set(rows.map((r) => r.competition)).size, rows.length, `trial ${i}: a league twice`);
    for (const row of rows) assert.equal(row.club.competition, row.competition);
    for (const rival of rivalsOf(home.slug)) assert.ok(!slugs.includes(rival), `trial ${i}: ${rival} beside home ${home.slug}`);
    for (let a = 0; a < slugs.length; a += 1) {
      for (let b = a + 1; b < slugs.length; b += 1) {
        assert.ok(!areRivals(slugs[a], slugs[b]), `trial ${i}: ${slugs[a]} and ${slugs[b]} are rivals`);
      }
    }
    assert.ok(!(slugs.includes("tottenham-hotspur") && slugs.includes("west-ham-united")), `trial ${i}: Spurs and West Ham`);
    // The member's own league row is their club.
    const own = rows.find((r) => r.competition === home.competition);
    assert.equal(own?.club.slug, home.slug, `trial ${i}: home row`);
  }
});

test("league rows carry the club only, no percentage", () => {
  const hand = CARDS.map((c, i) => ({ cardId: c.id, value: BINARY_CARD_IDS.includes(c.id) ? (i % 2 ? 1 : -1) : [1, -1, 0][i % 3] }));
  for (const row of bestClubPerLeague(hand, { rivals: RIVALS })) {
    assert.deepEqual(Object.keys(row).sort(), ["club", "competition", "label"]);
  }
});
