import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { makeFakeDb, has } from "./helpers/fake-db.mjs";
import {
  captainStrip,
  planCaptainChange,
  reconcileCaptains,
  resolveCaptains,
} from "../../lib/ultima/captains.js";
import { scoreLineup } from "../../lib/ultima/scoring.js";
import { xvSlotLocked } from "../../lib/ultima/lineup/lock.js";

const LEAGUES = ["pl", "laliga", "seriea", "bundesliga", "ligue1"];

/** A full XV: 3 players per league, ids like pl1 pl2 pl3, slots 1..15. */
function xv(overrides = {}) {
  const rows = [];
  let slot = 0;
  for (const league of LEAGUES) {
    for (let i = 1; i <= 3; i += 1) {
      slot += 1;
      rows.push({ slot, slot_group: league, player_id: `${league}${i}`, is_captain: false });
    }
  }
  return rows.map((r) => ({ ...r, ...(overrides[r.player_id] ?? {}) }));
}
const cap = (...ids) => Object.fromEntries(ids.map((id) => [id, { is_captain: true }]));

const NOW = Date.parse("2026-10-10T12:00:00Z");
const OPEN_FUTURE = "2026-10-10T18:00:00Z";
const OPEN_PAST = "2026-10-10T10:00:00Z";
const gwAllOpen = {
  state: "upcoming",
  league_open_at: Object.fromEntries(LEAGUES.map((l) => [l, OPEN_FUTURE])),
};

// ---------------------------------------------------------------------------
// resolveCaptains
// ---------------------------------------------------------------------------

test("one captain per country, no captain where none is set", () => {
  const { byLeague } = resolveCaptains(xv(cap("pl2", "ligue13")));
  assert.deepEqual(byLeague, { pl: "pl2", laliga: null, seriea: null, bundesliga: null, ligue1: "ligue13" });
});

test("two flagged captains in one country count once, lowest slot wins", () => {
  const { byLeague } = resolveCaptains(xv(cap("pl3", "pl1")));
  assert.equal(byLeague.pl, "pl1");
});

test("unset week carries last week's captain only while he is still in the XV", () => {
  const prev = { pl: "pl2", laliga: "laliga9" };
  const { byLeague, carried } = resolveCaptains(xv(), prev);
  assert.equal(byLeague.pl, "pl2");
  assert.equal(carried.pl, true);
  // laliga9 left the XV (benched, traded or dropped): no carry
  assert.equal(byLeague.laliga, null);
});

test("an explicit captain beats the carried one", () => {
  const { byLeague, carried } = resolveCaptains(xv(cap("pl3")), { pl: "pl1" });
  assert.equal(byLeague.pl, "pl3");
  assert.equal(carried.pl, false);
});

test("a carried captain must still be in the same country's slots", () => {
  const rows = xv().map((r) => (r.player_id === "pl2" ? { ...r, player_id: null } : r));
  assert.equal(resolveCaptains(rows, { pl: "pl2" }).byLeague.pl, null);
});

test("an empty gameweek has no captains and does not throw", () => {
  const { byLeague } = resolveCaptains([], { pl: "pl1" });
  assert.ok(Object.values(byLeague).every((v) => v === null));
  assert.deepEqual(resolveCaptains(undefined).byLeague.pl, null);
});

// ---------------------------------------------------------------------------
// Locking
// ---------------------------------------------------------------------------

test("captain lock follows the XV slot lock", () => {
  const live = { state: "live", league_open_at: { pl: OPEN_PAST, laliga: OPEN_FUTURE } };
  assert.equal(xvSlotLocked(live, "pl", NOW), true);
  assert.equal(xvSlotLocked(live, "laliga", NOW), false);
  assert.equal(xvSlotLocked({ state: "live", league_open_at: {} }, "ligue1", NOW), true);
  assert.equal(xvSlotLocked({ state: "final", league_open_at: {} }, "pl", NOW), true);
  assert.equal(xvSlotLocked({ state: "upcoming", league_open_at: {} }, "pl", NOW), false);
});

// ---------------------------------------------------------------------------
// planCaptainChange
// ---------------------------------------------------------------------------

test("choosing a new captain replaces the old one in one step", () => {
  const plan = planCaptainChange({ lineup: xv(cap("pl1")), playerId: "pl3", gameweek: gwAllOpen, now: NOW });
  assert.equal(plan.ok, true);
  assert.equal(plan.previousPlayerId, "pl1");
  const flagged = plan.lineup.filter((r) => r.is_captain).map((r) => r.player_id);
  assert.deepEqual(flagged, ["pl3"]);
});

test("a change in one country leaves the other countries' captains alone", () => {
  const plan = planCaptainChange({ lineup: xv(cap("pl1", "laliga2")), playerId: "pl2", gameweek: gwAllOpen, now: NOW });
  assert.deepEqual(
    plan.lineup.filter((r) => r.is_captain).map((r) => r.player_id).sort(),
    ["laliga2", "pl2"],
  );
});

test("choosing two captains in one country never leaves two", () => {
  let lineup = xv();
  for (const id of ["pl1", "pl2", "pl3"]) {
    lineup = planCaptainChange({ lineup, playerId: id, gameweek: gwAllOpen, now: NOW }).lineup;
    assert.equal(lineup.filter((r) => r.slot_group === "pl" && r.is_captain).length, 1);
  }
});

test("a locked country refuses the change; an open one still works", () => {
  const gw = { state: "live", league_open_at: { ...gwAllOpen.league_open_at, pl: OPEN_PAST } };
  const refused = planCaptainChange({ lineup: xv(cap("pl1")), playerId: "pl2", gameweek: gw, now: NOW });
  assert.deepEqual([refused.ok, refused.code], [false, "CAPTAIN_LOCKED"]);
  const fine = planCaptainChange({ lineup: xv(), playerId: "laliga1", gameweek: gw, now: NOW });
  assert.equal(fine.ok, true);
});

test("a live gameweek with no open time locks the country", () => {
  const plan = planCaptainChange({
    lineup: xv(),
    playerId: "pl1",
    gameweek: { state: "live", league_open_at: {} },
    now: NOW,
  });
  assert.equal(plan.code, "CAPTAIN_LOCKED");
});

test("only a player in the XV can captain; no gameweek is refused", () => {
  const benched = xv().map((r) => (r.player_id === "pl3" ? { ...r, player_id: null } : r));
  assert.equal(planCaptainChange({ lineup: benched, playerId: "pl3", gameweek: gwAllOpen, now: NOW }).code, "NOT_IN_XV");
  assert.equal(planCaptainChange({ lineup: [], playerId: "pl1", gameweek: gwAllOpen, now: NOW }).code, "NOT_IN_XV");
  assert.equal(planCaptainChange({ lineup: xv(), playerId: "pl1", gameweek: null, now: NOW }).code, "NO_GAMEWEEK");
});

test("choosing the current captain again is a no-op", () => {
  const plan = planCaptainChange({ lineup: xv(cap("pl1")), playerId: "pl1", gameweek: gwAllOpen, now: NOW });
  assert.equal(plan.ok && plan.noop, true);
});

// ---------------------------------------------------------------------------
// Captain leaves the XV
// ---------------------------------------------------------------------------

test("benched, traded or dropped: the country's captain clears", () => {
  const before = xv(cap("pl1", "laliga1"));
  // pl1 benched; laliga1 replaced by laliga9 (trade/drop then a new starter)
  const after = before.map((r) =>
    r.player_id === "pl1" ? { ...r, player_id: null } : r.player_id === "laliga1" ? { ...r, player_id: "laliga9" } : r,
  );
  const next = reconcileCaptains(before, after);
  assert.equal(next.filter((r) => r.is_captain).length, 0);
  const strip = captainStrip(resolveCaptains(next).byLeague, new Map());
  assert.ok(strip.every((s) => s.playerId === null && s.name === null));
});

test("a captain who only moves slot inside his country keeps the armband", () => {
  const before = xv(cap("pl1"));
  const after = before.map((r) =>
    r.slot === 1 ? { ...r, player_id: "pl2" } : r.slot === 2 ? { ...r, player_id: "pl1" } : r,
  );
  const next = reconcileCaptains(before, after);
  assert.deepEqual(next.filter((r) => r.is_captain).map((r) => [r.slot, r.player_id]), [[2, "pl1"]]);
});

test("the strip lists all five countries in order, filled or empty", () => {
  const players = new Map([["pl1", { name: "Saka" }]]);
  const strip = captainStrip({ pl: "pl1", laliga: null }, players);
  assert.deepEqual(strip.map((s) => s.league), LEAGUES);
  assert.equal(strip[0].name, "Saka");
  assert.equal(strip[1].name, null);
  assert.equal(strip[4].name, null);
});

// ---------------------------------------------------------------------------
// Scoring: captain x2, server side
// ---------------------------------------------------------------------------

const TH = { pl: { band1: 7, band2: 7.5 } };
const slotOf = (slot, stat, captain) => ({
  slot,
  captain,
  player: { id: `p${slot}`, league: "pl", draftRound: 20 },
  fixtureStats: [stat],
});

test("a captain doubles base points only; Bolt is added after and never doubled", () => {
  // 1 goal (3) + rating 7.6 (2) = 5 base; Bolt needs 6, so none. Second player: 2 goals + 7.6 = 8, Bolt +2 = 10.
  const lineup = [
    slotOf(1, { goals: 1, assists: 0, rating: 7.6 }, true),
    slotOf(2, { goals: 2, assists: 0, rating: 7.6 }, true),
    slotOf(3, { goals: 1, assists: 0, rating: 7.6 }, false),
  ];
  const r = scoreLineup(lineup, TH);
  assert.equal(r.slots[0].slotTotal, 10);
  assert.equal(r.slots[1].slotTotal, 18); // 8 base x2 = 16, plus Bolt 2
  assert.equal(r.slots[2].slotTotal, 5);
  assert.equal(r.captainTotal, 5 + 8);
  assert.equal(r.baseTotal, 5 + 8 + 5);
  assert.equal(r.boltTotal, 2);
  assert.equal(r.total, 18 + 2 + 13);
});

test("3 base captained = 6, no Bolt", () => {
  const r = scoreLineup([slotOf(1, { goals: 1, assists: 0, rating: null }, true)], TH);
  assert.equal(r.slots[0].base, 3);
  assert.equal(r.slots[0].bolt, 0);
  assert.equal(r.slots[0].slotTotal, 6);
});

test("6 base not captained = 8", () => {
  const r = scoreLineup([slotOf(1, { goals: 2, assists: 0, rating: null }, false)], TH);
  assert.equal(r.slots[0].bolt, 2);
  assert.equal(r.slots[0].slotTotal, 8);
});

test("6 base captained = 14: Bolt is judged on base and added after the multiplier", () => {
  const r = scoreLineup([slotOf(1, { goals: 2, assists: 0, rating: null }, true)], TH);
  assert.equal(r.slots[0].bolt, 2);
  assert.equal(r.slots[0].slotTotal, 14);
  assert.equal(r.total, 14);
  assert.equal(r.baseTotal + r.captainTotal, 12);
  assert.equal(r.boltTotal, 2);
});

test("no captain, no change: scoring stays as it was", () => {
  const lineup = [slotOf(1, { goals: 1, assists: 1, rating: 7.1 }, false)];
  const r = scoreLineup(lineup, TH);
  assert.equal(r.total, 5);
  assert.equal(r.captainTotal, 0);
});

// ---------------------------------------------------------------------------
// The scoring run: resolves captains, doubles once, carries last week's
// ---------------------------------------------------------------------------

const world = { lineups: [], prev: [], writes: [], rpc: { data: { ok: true }, error: null }, calls: [] };
const scoringDb = makeFakeDb((q) => {
  switch (q.table) {
    case "rpc:ultima_set_captain":
      world.calls.push(q.payload);
      return world.rpc;
    case "ultima_competition":
      return { data: { rating_thresholds: TH }, error: null };
    case "ultima_managers":
      return { data: [{ id: "m1" }], error: null };
    case "ultima_gameweeks":
      if (has(q, "eq", "number")) return { data: { id: "gw0" }, error: null };
      return { data: { id: "gw1", number: 2, competition_id: "c", state: "live" }, error: null };
    case "ultima_fixtures":
      return { data: [{ id: "f1" }], error: null };
    case "ultima_player_match_stats":
      return {
        data: [
          { player_id: "pl1", goals: 2, assists: 0, rating: 7.6 },
          { player_id: "pl2", goals: 1, assists: 0, rating: 7.6 },
        ],
        error: null,
      };
    case "ultima_players":
      return {
        data: ["pl1", "pl2", "pl3"].map((id) => ({ id, league: "pl", draft_round: 1, bolt_eligible: false })),
        error: null,
      };
    case "ultima_lineups":
      if (q.op === "update") {
        world.writes.push(q);
        return { data: null, error: null };
      }
      if (has(q, "eq", "is_captain", true)) return { data: world.prev, error: null };
      return { data: world.lineups, error: null };
    case "ultima_manager_gameweek_scores":
      world.writes.push(q);
      return { data: null, error: null };
    default:
      return { data: [], error: null };
  }
});
mock.module("@/lib/ultima/server/db", { namedExports: { getUltimaDb: () => scoringDb } });
const { recomputeGameweekScores } = await import("../../lib/ultima/server/scoring-run.js");

const row = (slot, id, captain = false) => ({
  manager_id: "m1", slot, slot_group: "pl", player_id: id, is_captain: captain,
});
const scoreWrite = () => world.writes.filter((q) => q.table === "ultima_manager_gameweek_scores").at(-1).payload;

test("scoring run: pl1 scores 2 goals + rating = 8 raw, captain doubles to 16", async () => {
  world.writes = [];
  world.prev = [];
  world.lineups = [row(1, "pl1", true), row(2, "pl2"), row(3, "pl3")];
  await recomputeGameweekScores("c", "gw1");
  // base: pl1 8 + pl2 5 = 13, captain extra 8, Bolt none (draftRound 1)
  assert.equal(scoreWrite().points, 13 + 8);
  assert.equal(scoreWrite().bolt_points, 0);
});

test("scoring run: two captains in one country double only one player", async () => {
  world.writes = [];
  world.lineups = [row(1, "pl1", true), row(2, "pl2", true), row(3, "pl3")];
  await recomputeGameweekScores("c", "gw1");
  assert.equal(scoreWrite().points, 13 + 8); // lowest slot (pl1) only
});

test("scoring run: unset week carries last week's captain if still in the XV", async () => {
  world.writes = [];
  world.prev = [{ manager_id: "m1", slot_group: "pl", player_id: "pl2" }];
  world.lineups = [row(1, "pl1"), row(2, "pl2"), row(3, "pl3")];
  await recomputeGameweekScores("c", "gw1");
  assert.equal(scoreWrite().points, 13 + 5);
  // and the carry is written onto this week's row so next week can carry again
  const carry = world.writes.find((q) => q.table === "ultima_lineups" && q.op === "update");
  assert.deepEqual(carry.payload, { is_captain: true });
  assert.ok(has(carry, "eq", "slot", 2));
});

test("scoring run: last week's captain traded away or benched gives no double", async () => {
  world.writes = [];
  world.prev = [{ manager_id: "m1", slot_group: "pl", player_id: "pl9" }];
  world.lineups = [row(1, "pl1"), row(2, "pl2"), row(3, "pl3")];
  await recomputeGameweekScores("c", "gw1");
  assert.equal(scoreWrite().points, 13);
  assert.equal(world.writes.filter((q) => q.table === "ultima_lineups").length, 0);
});

test("scoring run: an empty gameweek scores zero and does not throw", async () => {
  world.writes = [];
  world.prev = [];
  world.lineups = [];
  await recomputeGameweekScores("c", "gw1");
  assert.equal(scoreWrite().points, 0);
});

// ---------------------------------------------------------------------------
// setCaptain (server): checks first, then one RPC
// ---------------------------------------------------------------------------

mock.module("@/lib/ultima/server/events", { namedExports: { publishUltimaEvent: () => {} } });
mock.module("@/lib/ultima/server/record-event", { namedExports: { recordUltimaEvent: async () => {} } });
const { setCaptain } = await import("../../lib/ultima/server/lineup.js");

const dbRows = (overrides) => xv(overrides).map((r) => ({ ...r, manager_id: "m1", gameweek_id: "g1", locked_at: null, auto_started: false }));
const FUTURE = { id: "g1", state: "upcoming", league_open_at: Object.fromEntries(LEAGUES.map((l) => [l, "2099-01-01T00:00:00Z"])) };

test("setCaptain: a locked country never reaches the database", async () => {
  world.calls = [];
  world.lineups = dbRows();
  const gw = { ...FUTURE, league_open_at: { ...FUTURE.league_open_at, pl: "2000-01-01T00:00:00Z" } };
  const res = await setCaptain({ managerId: "m1", gameweekId: "g1", gameweek: gw, playerId: "pl1" });
  assert.equal(res.code, "CAPTAIN_LOCKED");
  assert.equal(world.calls.length, 0);
});

test("setCaptain: one RPC call, and the result lists the new captains", async () => {
  world.calls = [];
  world.lineups = dbRows(cap("pl1"));
  const res = await setCaptain({ managerId: "m1", gameweekId: "g1", gameweek: FUTURE, playerId: "pl2" });
  assert.equal(res.ok, true);
  assert.equal(world.calls.length, 1);
  assert.deepEqual(world.calls[0], { p_manager_id: "m1", p_gameweek_id: "g1", p_player_id: "pl2" });
  assert.equal(res.captains.pl, "pl2");
});

test("setCaptain: before 0051 is applied it says captains open shortly, no crash", async () => {
  world.lineups = dbRows();
  world.rpc = { data: null, error: { message: "function ultima_set_captain does not exist" } };
  const res = await setCaptain({ managerId: "m1", gameweekId: "g1", gameweek: FUTURE, playerId: "pl1" });
  assert.equal(res.code, "CAPTAIN_UNAVAILABLE");
  world.rpc = { data: { ok: true }, error: null };
});

test("setCaptain: the database's own lock answer is passed through", async () => {
  world.lineups = dbRows();
  world.rpc = { data: { ok: false, code: "CAPTAIN_LOCKED" }, error: null };
  const res = await setCaptain({ managerId: "m1", gameweekId: "g1", gameweek: FUTURE, playerId: "pl1" });
  assert.equal(res.code, "CAPTAIN_LOCKED");
  world.rpc = { data: { ok: true }, error: null };
});

test("setCaptain: a player not in the XV, and a missing gameweek, are refused up front", async () => {
  world.calls = [];
  world.lineups = dbRows();
  assert.equal((await setCaptain({ managerId: "m1", gameweekId: "g1", gameweek: FUTURE, playerId: "nobody" })).code, "NOT_IN_XV");
  assert.equal((await setCaptain({ managerId: "m1", gameweekId: "g1", gameweek: null, playerId: "pl1" })).code, "NO_GAMEWEEK");
  assert.equal(world.calls.length, 0);
});

test("resolveCaptains: captain_off stops last week's captain carrying over", () => {
  assert.equal(resolveCaptains(xv({ pl1: { captain_off: true } }), { pl: "pl1" }).byLeague.pl, null);
  assert.equal(resolveCaptains(xv(), { pl: "pl1" }).byLeague.pl, "pl1");
});
