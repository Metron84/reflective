import test from "node:test";
import assert from "node:assert/strict";
import { CARDS, BINARY_CARD_IDS } from "@/lib/crest/cards.js";
import { clearCrestLeaguesCache, getCrestLeagues } from "@/lib/account/crest-leagues.js";
import { coversEveryLeague, getRevealed, revealLeague } from "@/lib/account/crest-reveals.js";

const answers = CARDS.map((c, i) => ({
  cardId: c.id,
  value: BINARY_CARD_IDS.includes(c.id) ? (i % 2 ? 1 : -1) : [1, -1, 0][i % 3],
}));
const SAVED = "2026-10-10T10:00:00Z";
const BEFORE = "2026-10-09T10:00:00Z";
const AFTER = "2026-10-11T10:00:00Z";

/** In-memory stand-in for the two tables the reveal flow touches. */
function fakeDb({ reveals = [], savedAt = SAVED, hasCrest = true } = {}) {
  const db = { reveals: [...reveals], inserts: [] };
  db.client = {
    from(table) {
      if (table === "crest_results") {
        return {
          select: (cols) => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: hasCrest
                  ? cols.includes("answers")
                    ? { answers }
                    : { saved_at: savedAt, stake: null, scope: null }
                  : null,
                error: null,
              }),
            }),
          }),
        };
      }
      assert.equal(table, "crest_reveals");
      return {
        select: () => ({ eq: async () => ({ data: db.reveals, error: null }) }),
        upsert: async (row) => {
          db.inserts.push(row);
          if (!db.reveals.some((r) => r.competition === row.competition)) {
            db.reveals.push({ competition: row.competition, revealed_at: AFTER });
          }
          return { error: null };
        },
      };
    },
  };
  return db;
}

test("coversEveryLeague needs every league and at least one", () => {
  const leagues = [{ competition: "A" }, { competition: "B" }];
  assert.equal(coversEveryLeague(leagues, ["A"]), false);
  assert.equal(coversEveryLeague(leagues, ["B", "A"]), true);
  assert.equal(coversEveryLeague([], []), false);
});

test("getRevealed ignores rows from an older Crest result and unknown leagues", async () => {
  clearCrestLeaguesCache();
  const db = fakeDb({
    reveals: [
      { competition: "Premier League", revealed_at: AFTER },
      { competition: "LaLiga", revealed_at: BEFORE },
      { competition: "Made Up League", revealed_at: AFTER },
    ],
  });
  const crest = await getCrestLeagues(db.client, "u1");
  assert.deepEqual(await getRevealed(db.client, "u1", crest), ["Premier League"]);
});

test("getRevealed is empty without a Crest or a client", async () => {
  assert.deepEqual(await getRevealed(null, "u1", { savedAt: SAVED, leagues: [] }), []);
  assert.deepEqual(await getRevealed(fakeDb().client, "u1", null), []);
});

test("revealLeague saves one row for the member and reports progress", async () => {
  clearCrestLeaguesCache();
  const db = fakeDb();
  const r = await revealLeague(db.client, "u1", "Premier League");
  assert.equal(r.status, 200);
  assert.deepEqual(db.inserts, [{ user_id: "u1", competition: "Premier League" }]);
  assert.deepEqual(r.revealed, ["Premier League"]);
  assert.equal(r.everyLeague, false);
});

test("revealLeague reports everyLeague once the last league is revealed", async () => {
  clearCrestLeaguesCache();
  const db = fakeDb();
  const crest = await getCrestLeagues(db.client, "u1");
  const [last, ...rest] = [...crest.leagues].reverse();
  db.reveals = rest.map((l) => ({ competition: l.competition, revealed_at: AFTER }));
  const r = await revealLeague(db.client, "u1", last.competition);
  assert.equal(r.everyLeague, true);
});

test("revealLeague rejects an unknown league and a member with no Crest", async () => {
  clearCrestLeaguesCache();
  const db = fakeDb();
  assert.equal((await revealLeague(db.client, "u1", "Nope")).status, 400);
  assert.equal(db.inserts.length, 0);
  clearCrestLeaguesCache();
  assert.equal((await revealLeague(fakeDb({ hasCrest: false }).client, "u2", "LaLiga")).status, 409);
});
