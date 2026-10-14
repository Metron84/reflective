import test from "node:test";
import assert from "node:assert/strict";
import { CARDS, BINARY_CARD_IDS } from "@/lib/crest/cards.js";
import { CREST_COMPETITIONS } from "@/lib/crest/competitions.js";
import { CLUBS } from "@/lib/crest/clubs.js";
import {
  DEFAULT_ALPHA,
  arrivalSummary,
  bestClubPerLeague,
  leagueMap,
  matchLeague,
} from "@/lib/crest/match.js";
import { CREST_GROUPS } from "@/lib/crest/clubs.js";
import { STAKES } from "@/lib/crest/stakes.js";
import { leaguePalette, contrast, AA_TEXT, AA_GRAPHIC } from "@/lib/crest/colour.js";
import { getCrestLeagues, clearCrestLeaguesCache } from "@/lib/account/crest-leagues.js";

const answers = CARDS.map((c, i) => ({
  cardId: c.id,
  value: BINARY_CARD_IDS.includes(c.id) ? (i % 2 ? 1 : -1) : [1, -1, 0][i % 3],
}));

test("matchLeague returns a club from that competition only", () => {
  const best = matchLeague(answers, "Premier League");
  assert.equal(best.club.competition, "Premier League");
  assert.ok(best.matchPct >= 0 && best.matchPct <= 100);
});

test("matchLeague is null for a competition with no clubs", () => {
  assert.equal(matchLeague(answers, "Not A League"), null);
});

test("bestClubPerLeague covers exactly the competitions that have clubs", () => {
  const rows = bestClubPerLeague(answers);
  const expected = CREST_COMPETITIONS.filter((c) => CLUBS.some((k) => k.competition === c));
  assert.deepEqual(rows.map((r) => r.competition), expected);
  for (const r of rows) assert.equal(r.club.competition, r.competition);
});

test("every club colour yields an AA palette", () => {
  for (const club of CLUBS) {
    const p = leaguePalette(club.color);
    assert.ok(contrast(p.primary, p.text) >= AA_TEXT, `${club.slug} text`);
    assert.ok(contrast(p.secondary, p.primary) >= AA_GRAPHIC, `${club.slug} accent`);
  }
  assert.ok(contrast(leaguePalette(null).primary, leaguePalette(null).text) >= AA_TEXT);
});

function fakeSupabase(row, counter) {
  return {
    from: () => ({
      select: (cols) => ({
        eq: () => ({
          maybeSingle: async () => {
            counter.reads.push(cols);
            return { data: cols.includes("answers") ? { answers: row.answers } : { saved_at: row.saved_at, stake: null, scope: null }, error: null };
          },
        }),
      }),
    }),
  };
}

test("league cache is reused until crest_results.saved_at changes", async () => {
  clearCrestLeaguesCache();
  const counter = { reads: [] };
  const row = { answers, saved_at: "2026-10-01T10:00:00Z" };
  const db = fakeSupabase(row, counter);
  const a = await getCrestLeagues(db, "u1");
  const b = await getCrestLeagues(db, "u1");
  assert.equal(a, b);
  assert.equal(counter.reads.filter((c) => c.includes("answers")).length, 1);
  row.saved_at = "2026-10-02T10:00:00Z";
  const c = await getCrestLeagues(db, "u1");
  assert.notEqual(c, a);
  assert.equal(c.savedAt, "2026-10-02T10:00:00Z");
});

test("no crest_results row returns null", async () => {
  clearCrestLeaguesCache();
  const db = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) };
  assert.equal(await getCrestLeagues(db, "u2"), null);
});

// Seeded, so a failure reproduces.
function seeded(seed) {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
}

test("the saved club is the league pick for its own league, across scopes and chips", () => {
  const rnd = seeded(20261014);
  const scopes = [null, ...CREST_GROUPS];
  const stakes = [null, ...STAKES.map((x) => x.id)];
  const trials = 250;
  for (let i = 0; i < trials; i += 1) {
    const hand = CARDS.map((c) => ({
      cardId: c.id,
      value: BINARY_CARD_IDS.includes(c.id) ? (rnd() < 0.5 ? -1 : 1) : [1, -1, 0][Math.floor(rnd() * 3)],
    }));
    const scope = scopes[Math.floor(rnd() * scopes.length)];
    const stake = stakes[Math.floor(rnd() * stakes.length)];
    const saved = arrivalSummary(hand, DEFAULT_ALPHA, { group: scope, stake }).club;

    const row = leagueMap(hand, DEFAULT_ALPHA, { group: scope, stake }).find(
      (r) => r.competition === saved.competition
    );
    assert.equal(row.clubs[0].club.slug, saved.slug, `leagueMap, trial ${i}`);

    const mine = bestClubPerLeague(hand, { stake, scope }).find((r) => r.competition === saved.competition);
    assert.equal(mine.club.slug, saved.slug, `bestClubPerLeague, trial ${i}`);
  }
});

test("a scoped member still gets a club in leagues outside their scope", () => {
  const rows = bestClubPerLeague(answers, { scope: "England" });
  const expected = CREST_COMPETITIONS.filter((c) => CLUBS.some((k) => k.competition === c));
  assert.deepEqual(rows.map((r) => r.competition), expected);
});
