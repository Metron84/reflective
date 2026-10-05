import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { makeFakeDb } from "./helpers/fake-db.mjs";
import {
  UNTOUCHABLE_LINE,
  UNTOUCHABLE_MAX,
  canAddUntouchable,
  canCancelTrade,
  untouchableHit,
} from "../../lib/ultima/trades/rules.js";
import { BLOCK_CHIPS, countryTags, filterSellers, sortSellers } from "../../lib/ultima/trades/block-view.js";
import { TRADE_LOG_EVENTS, tradeLogLine } from "../../lib/ultima/trades/log-line.js";

// ---------------------------------------------------------------------------
// Pure rules
// ---------------------------------------------------------------------------

test("untouchable: an asked-for player on the list is a hit", () => {
  assert.equal(untouchableHit(["a", "b"], ["b", "z"]), "b");
  assert.equal(untouchableHit(["a"], ["b"]), null);
  assert.equal(untouchableHit(["a"], undefined), null);
});

test("untouchable: at most 3 per manager, re-adding one is a no-op", () => {
  assert.equal(UNTOUCHABLE_MAX, 3);
  assert.deepEqual(canAddUntouchable(["a", "b"], "c"), { ok: true, already: false });
  assert.deepEqual(canAddUntouchable(["a", "b", "c"], "a"), { ok: true, already: true });
  assert.deepEqual(canAddUntouchable(["a", "b", "c"], "d"), { ok: false, code: "UNTOUCHABLE_LIMIT" });
});

test("cancel: only the proposer, only while proposed", () => {
  const trade = { state: "proposed", proposer_id: "m1", receiver_id: "m2" };
  assert.equal(canCancelTrade(trade, "m1"), true);
  assert.equal(canCancelTrade(trade, "m2"), false);
  assert.equal(canCancelTrade({ ...trade, state: "review" }, "m1"), false);
  assert.equal(canCancelTrade({ ...trade, state: "executed" }, "m1"), false);
  assert.equal(canCancelTrade(null, "m1"), false);
});

const sellers = [
  {
    id: "s1",
    players: [
      { id: "p1", league: "pl", updated_at: "2026-10-01T10:00:00Z" },
      { id: "p2", league: "laliga", updated_at: "2026-10-03T10:00:00Z" },
    ],
  },
  { id: "s2", players: [{ id: "p3", league: "pl", updated_at: "2026-10-02T10:00:00Z" }] },
  { id: "s3", players: [{ id: "p4", league: "ligue1", updated_at: "2026-10-04T10:00:00Z" }] },
];

test("block chips: All then ENG ESP ITA GER FRA", () => {
  assert.deepEqual(BLOCK_CHIPS.map((c) => c.label), ["All", "ENG", "ESP", "ITA", "GER", "FRA"]);
  assert.equal(countryTags(["pl", "seriea"]), "ENG, ITA");
});

test("block filter: a country keeps its players and drops empty sellers", () => {
  assert.equal(filterSellers(sellers, "all").length, 3);
  const pl = filterSellers(sellers, "pl");
  assert.deepEqual(pl.map((s) => s.id), ["s1", "s2"]);
  assert.deepEqual(pl[0].players.map((p) => p.id), ["p1"]);
  assert.deepEqual(filterSellers(sellers, "bundesliga"), []);
});

test("block sort: newest listing first, sellers ordered by their newest player", () => {
  const out = sortSellers(sellers, "newest");
  assert.deepEqual(out.map((s) => s.id), ["s3", "s1", "s2"]);
  assert.deepEqual(out.find((s) => s.id === "s1").players.map((p) => p.id), ["p2", "p1"]);
  assert.deepEqual(sortSellers(sellers, "rank").map((s) => s.id), ["s1", "s2", "s3"]);
});

test("log lines: every trade event reads as one sentence with names and players", () => {
  const ctx = {
    actor: "Cat",
    proposer: "Ajax FC",
    receiver: "Bolt United",
    give: ["Saka"],
    get: ["Pedri", "Gavi"],
    reason: "player_dropped",
  };
  for (const event of TRADE_LOG_EVENTS) {
    const line = tradeLogLine(event, ctx);
    assert.ok(line && line.endsWith("."), `${event}: ${line}`);
    assert.ok(!line.includes("—") && !line.includes("–"), "no dashes");
  }
  assert.equal(tradeLogLine("trade_cancelled", ctx), "Ajax FC withdrew an offer to Bolt United. Saka for Pedri and Gavi.");
  assert.match(tradeLogLine("trade_void", ctx), /voided\. A player was dropped\./);
  assert.equal(tradeLogLine("pick_made", ctx), null);
});

// ---------------------------------------------------------------------------
// Server: proposing for an untouchable player, cancelling, setting flags
// ---------------------------------------------------------------------------

const world = {
  untouchables: [],
  trade: null,
  rosters: {},
  tradeUpdates: [],
};
const roster = (ids, league = "pl") => ids.map((id) => ({ id, name: id, league, club: "C", position: "FWD", seed_metrics: {} }));

function handler(q) {
  switch (q.table) {
    case "ultima_gameweeks":
      return { data: { number: 4, window_start: "2026-10-29T20:00:00Z", window_end: "2026-11-05T19:59:59Z" } };
    case "ultima_competition":
      return { data: { trade_deadline_gw: null } };
    case "ultima_managers":
      return {
        data: [
          { id: "m1", is_bot: false, competition_id: "c1" },
          { id: "m2", is_bot: false, competition_id: "c1" },
        ],
      };
    case "ultima_untouchables":
      if (q.op === "insert") {
        world.inserted = q.payload;
        return { data: null, error: null };
      }
      return { data: world.untouchables.map((player_id) => ({ player_id })), error: null };
    case "ultima_trades":
      if (q.op === "update") {
        world.tradeUpdates.push(q.payload);
        return { data: world.trade && world.trade.state === "proposed" ? [{ id: world.trade.id }] : [], error: null };
      }
      if (q.options?.head) return { count: 0, data: null };
      return { data: world.trade ? [world.trade] : [], error: null };
    case "ultima_trade_players":
      return { data: [] };
    case "ultima_trade_block":
      world.blockDeleted = q.op === "delete";
      return { data: null, error: null };
    default:
      return { data: [], error: null };
  }
}

let fake = makeFakeDb(handler);
mock.module("@/lib/ultima/server/db", { namedExports: { getUltimaDb: () => fake } });
mock.module("@/lib/ultima/server/lineup", {
  namedExports: { getManagerRoster: async (id) => world.rosters[id] ?? [] },
});
mock.module("@/lib/ultima/server/events", { namedExports: { publishUltimaEvent: () => {} } });
mock.module("@/lib/ultima/server/notify", { namedExports: { notifyTradeProposedAsync: () => {}, notifyManagerOnceAsync: () => {} } });
mock.module("@/lib/ultima/server/scoring-run", { namedExports: { getStandings: async () => [] } });
const recorded = [];
mock.module("@/lib/ultima/server/record-event", {
  namedExports: { recordUltimaEvent: async (e) => recorded.push(e) },
});

const { proposeTrade, cancelTrade } = await import("../../lib/ultima/server/trades.js");
const { setUntouchable } = await import("../../lib/ultima/server/untouchables.js");

function reset() {
  world.untouchables = [];
  world.trade = null;
  world.tradeUpdates = [];
  world.inserted = null;
  world.blockDeleted = false;
  recorded.length = 0;
  fake = makeFakeDb(handler);
  world.rosters = {
    m1: roster(["a1", "a2", "a3", "a4"]),
    m2: roster(["b1", "b2", "b3", "b4"]),
  };
}

test("propose: asking for an untouchable player is rejected with the plain line", async () => {
  reset();
  world.untouchables = ["b1"];
  const res = await proposeTrade({
    competitionId: "c1",
    proposerId: "m1",
    receiverId: "m2",
    givePlayerIds: ["a1"],
    getPlayerIds: ["b1"],
  });
  assert.equal(res.ok, false);
  assert.equal(res.code, "UNTOUCHABLE");
  const { ULTIMA_ERRORS } = await import("../../lib/ultima/errors.js");
  assert.equal(ULTIMA_ERRORS.UNTOUCHABLE, UNTOUCHABLE_LINE);
  assert.equal(UNTOUCHABLE_LINE, "That player is untouchable.");
  assert.ok(!fake.log.some((q) => q.table === "ultima_trades" && q.op === "insert"), "nothing was created");
});

test("propose: a player who is not untouchable gets past the guard", async () => {
  reset();
  world.untouchables = ["b2"];
  const res = await proposeTrade({
    competitionId: "c1",
    proposerId: "m1",
    receiverId: "m2",
    givePlayerIds: ["a1"],
    getPlayerIds: ["b1"],
  });
  assert.notEqual(res.code, "UNTOUCHABLE");
});

test("cancel: the proposer withdraws a proposed offer and the event is recorded", async () => {
  reset();
  world.trade = { id: "t1", state: "proposed", proposer_id: "m1", receiver_id: "m2", competition_id: "c1" };
  const res = await cancelTrade({ tradeId: "t1", managerId: "m1" });
  assert.deepEqual(res, { ok: true, state: "cancelled" });
  assert.equal(world.tradeUpdates[0].state, "cancelled");
  assert.equal(recorded[0].event, "trade_cancelled");
});

test("cancel: the receiver cannot withdraw, and an offer in review cannot be withdrawn", async () => {
  reset();
  world.trade = { id: "t1", state: "proposed", proposer_id: "m1", receiver_id: "m2", competition_id: "c1" };
  assert.equal((await cancelTrade({ tradeId: "t1", managerId: "m2" })).ok, false);
  world.trade = { ...world.trade, state: "review" };
  assert.equal((await cancelTrade({ tradeId: "t1", managerId: "m1" })).ok, false);
  assert.equal(world.tradeUpdates.length, 0, "no state change");
});

test("untouchable: the fourth is refused, a foreign player is refused, marking clears the block row", async () => {
  reset();
  world.untouchables = ["a1", "a2", "a3"];
  const full = await setUntouchable({ managerId: "m1", playerId: "a4", on: true });
  assert.deepEqual(full, { ok: false, code: "UNTOUCHABLE_LIMIT" });

  reset();
  const foreign = await setUntouchable({ managerId: "m1", playerId: "b1", on: true });
  assert.equal(foreign.ok, false);

  reset();
  const ok = await setUntouchable({ managerId: "m1", playerId: "a1", on: true });
  assert.equal(ok.ok, true);
  assert.equal(world.inserted.player_id, "a1");
  assert.equal(world.blockDeleted, true, "block row removed");
});

test("every trade route gates on requireSeatApi with the write check", async () => {
  const { readFileSync, readdirSync } = await import("node:fs");
  const root = new URL("../../app/api/ultima/trades/", import.meta.url);
  for (const dir of readdirSync(root)) {
    const source = readFileSync(new URL(`${dir}/route.js`, root), "utf8");
    assert.match(source, /requireSeatApi\(\{ mutating: true \}\)/, `${dir} uses requireSeatApi`);
    assert.doesNotMatch(source, /getSessionUser|getManagerForUser/, `${dir} has no direct session read`);
  }
});
