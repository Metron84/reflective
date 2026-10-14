import test from "node:test";
import assert from "node:assert/strict";
import { CARDS, BINARY_CARD_IDS } from "@/lib/crest/cards.js";
import { CREST_COMPETITIONS } from "@/lib/crest/competitions.js";
import { CLUBS } from "@/lib/crest/clubs.js";
import { matchLeague, bestClubPerLeague } from "@/lib/crest/match.js";
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
            return { data: cols.includes("answers") ? { answers: row.answers } : { saved_at: row.saved_at, stake: null }, error: null };
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
