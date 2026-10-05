import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { makeFakeDb, has } from "./helpers/fake-db.mjs";
import {
  buildActions,
  buildChips,
  buildSwapList,
  cleanListNote,
  releaseBlock,
} from "../../lib/ultima/player-card/rules.js";
import { LIVE_CAP_LINE, FROZEN_LINE, UNTOUCHABLE_LINE } from "../../lib/ultima/trades/rules.js";

// ---------------------------------------------------------------------------
// Chips and actions
// ---------------------------------------------------------------------------

const base = {
  kind: "mine",
  hasGameweek: true,
  tradesOpen: true,
  marketOpen: true,
  liveOutgoing: 0,
  untouchableCount: 0,
};
const ids = (actions) => actions.map((a) => a.id);
const byId = (actions, id) => actions.find((a) => a.id === id);

test("chips: only the facts that are true, in card order", () => {
  const chips = buildChips({
    captain: true,
    inXv: true,
    listed: true,
    untouchable: false,
    locked: true,
    frozen: false,
    liveOffers: 2,
    movedFrom: "Ajax",
  });
  assert.deepEqual(
    chips.map((c) => c.label),
    ["Captain", "In XV", "Transfer listed", "Locked", "In 2 live offers", "Moved from Ajax"],
  );
  assert.equal(buildChips({ liveOffers: 1 })[0].label, "In 1 live offer");
  assert.deepEqual(buildChips({}), []);
});

test("actions: a bot's player only offers the shortlist, never Make offer", () => {
  const actions = buildActions({ ...base, kind: "bot", shortlisted: false });
  assert.deepEqual(ids(actions), ["shortlist_on"]);
  assert.deepEqual(ids(buildActions({ ...base, kind: "bot", shortlisted: true })), ["shortlist_off"]);
});

test("actions: another human's player has Make offer as primary plus the shortlist", () => {
  const actions = buildActions({ ...base, kind: "human" });
  assert.deepEqual(ids(actions), ["offer", "shortlist_on"]);
  assert.equal(byId(actions, "offer").primary, true);
  assert.equal(byId(actions, "offer").disabled, false);
});

test("actions: Make offer stays visible but disabled with the reason", () => {
  assert.equal(byId(buildActions({ ...base, kind: "human", untouchable: true }), "offer").reason, UNTOUCHABLE_LINE);
  assert.equal(byId(buildActions({ ...base, kind: "human", frozen: true }), "offer").reason, FROZEN_LINE);
  assert.equal(byId(buildActions({ ...base, kind: "human", liveOutgoing: 3 }), "offer").reason, LIVE_CAP_LINE);
  assert.match(byId(buildActions({ ...base, kind: "human", pairLive: "sent" }), "offer").reason, /live offer/);
  assert.match(byId(buildActions({ ...base, kind: "human", tradesOpen: false }), "offer").reason, /deadline/);
  assert.equal(byId(buildActions({ ...base, kind: "human", liveOutgoing: 3 }), "offer").disabled, true);
});

test("actions: a free agent has Add to squad as primary, disabled before the draft ends", () => {
  const open = buildActions({ ...base, kind: "free" });
  assert.deepEqual(ids(open), ["sign", "shortlist_on"]);
  assert.equal(byId(open, "sign").primary, true);
  const closed = buildActions({ ...base, kind: "free", marketOpen: false });
  assert.equal(byId(closed, "sign").disabled, true);
  assert.match(byId(closed, "sign").reason, /draft/);
});

test("actions: my player in the XV can be captained, benched, listed, protected, offered, dropped", () => {
  const actions = buildActions({ ...base, inXv: true });
  assert.deepEqual(ids(actions), ["captain_on", "xv_out", "list", "untouchable_on", "offer_mine", "drop_sign"]);
  assert.ok(actions.every((a) => !a.disabled));
});

test("actions: a captain offers Remove captain, a listed player offers to unlist", () => {
  const actions = buildActions({ ...base, inXv: true, captain: true, listed: true, untouchable: false });
  assert.deepEqual(ids(actions).slice(0, 3), ["captain_off", "xv_out", "unlist"]);
});

test("actions: a locked slot keeps every XV move visible and disabled with the reason", () => {
  const actions = buildActions({ ...base, inXv: true, locked: true, slotLocked: true, countryLocked: true });
  assert.match(byId(actions, "captain_on").reason, /Captains are set/);
  assert.match(byId(actions, "xv_out").reason, /locked in your XV/);
  assert.match(byId(actions, "drop_sign").reason, /locked in your XV/);
});

test("actions: a carried captain can be removed like any other", () => {
  const actions = buildActions({ ...base, inXv: true, captain: true, captainCarried: true });
  assert.equal(byId(actions, "captain_off").disabled, false);
});

test("actions: bench players need a free slot, and a full country says so", () => {
  const actions = buildActions({ ...base, inXv: false, xvFull: true });
  assert.match(byId(actions, "xv_in").reason, /full in that country/);
  assert.match(byId(actions, "captain_on").reason, /Start him in your XV first/);
});

test("actions: no gameweek disables the XV moves with one reason", () => {
  const actions = buildActions({ ...base, hasGameweek: false, inXv: true });
  assert.match(byId(actions, "xv_out").reason, /No gameweek/);
});

test("actions: untouchable is capped at 3 and never with the list", () => {
  assert.match(byId(buildActions({ ...base, untouchableCount: 3 }), "untouchable_on").reason, /protect 3/);
  assert.match(byId(buildActions({ ...base, untouchable: true }), "list").reason, /off the list/);
});

test("actions: an accepted deal blocks offering and dropping my player", () => {
  const actions = buildActions({ ...base, frozen: true });
  assert.equal(byId(actions, "offer_mine").reason, FROZEN_LINE);
  assert.match(byId(actions, "drop_sign").reason, /accepted deal/);
});

test("list note: 80 characters, links dropped, empty is null", () => {
  assert.equal(cleanListNote("x".repeat(100)).length, 80);
  assert.equal(cleanListNote("  Open   to offers "), "Open to offers");
  assert.equal(cleanListNote("see https://x.test"), null);
  assert.equal(cleanListNote("   "), null);
  assert.equal(cleanListNote(7), null);
});

// ---------------------------------------------------------------------------
// Who goes
// ---------------------------------------------------------------------------

const P = (id, league) => ({ id, name: id, league });
const squad = () => [
  ...["a1", "a2", "a3", "a4"].map((id) => P(id, "pl")),
  ...["b1", "b2", "b3"].map((id) => P(id, "laliga")),
  ...["c1", "c2", "c3", "c4"].map((id) => P(id, "seriea")),
  ...["d1", "d2", "d3"].map((id) => P(id, "bundesliga")),
  ...["e1", "e2", "e3"].map((id) => P(id, "ligue1")),
];

test("who goes: same country first, another country only if it stays at 3 or more", () => {
  const rows = buildSwapList({ mode: "add", roster: squad(), subject: P("x1", "pl"), candidates: squad() });
  assert.deepEqual(rows.slice(0, 4).map((r) => r.player.id).sort(), ["a1", "a2", "a3", "a4"]);
  assert.ok(rows.slice(0, 4).every((r) => r.sameCountry && r.can));
  const other = (id) => rows.find((r) => r.player.id === id);
  assert.equal(other("c1").can, true, "ITA has 4, stays at 3");
  assert.equal(other("b1").can, false, "ESP would drop to 2");
  assert.match(other("b1").reason, /2 ESP\. You need 3\./);
});

test("who goes: a locked XV slot and an accepted deal are Can't with the reason", () => {
  const rows = buildSwapList({
    mode: "add",
    roster: squad(),
    subject: P("x1", "pl"),
    candidates: squad(),
    lockedXvIds: ["a1"],
    frozenIds: ["a2"],
  });
  const a1 = rows.find((r) => r.player.id === "a1");
  const a2 = rows.find((r) => r.player.id === "a2");
  assert.equal(a1.can, false);
  assert.match(a1.reason, /locked in your XV/);
  assert.equal(a2.can, false);
  assert.match(a2.reason, /accepted deal/);
  assert.equal(rows.find((r) => r.player.id === "a3").can, true);
  assert.equal(releaseBlock({ playerId: "zz", lockedXvIds: ["a1"], frozenIds: [] }), null);
});

test("who goes: live offers a release would void are named", () => {
  const rows = buildSwapList({
    mode: "add",
    roster: squad(),
    subject: P("x1", "pl"),
    candidates: squad(),
    liveOfferTeams: new Map([["a3", ["Ajax FC"]]]),
  });
  assert.deepEqual(rows.find((r) => r.player.id === "a3").voids, ["Ajax FC"]);
});

test("drop and sign: free agents of the same country first, a cross-country swap that breaks a floor is Can't", () => {
  const free = [P("f1", "laliga"), P("f2", "pl"), P("f3", "seriea")];
  const rows = buildSwapList({ mode: "drop", roster: squad(), subject: P("a1", "pl"), candidates: free });
  assert.equal(rows[0].player.id, "f2");
  assert.equal(rows[0].sameCountry, true);
  assert.equal(rows.find((r) => r.player.id === "f1").can, true, "PL stays at 3");
  const tight = buildSwapList({ mode: "drop", roster: squad(), subject: P("b1", "laliga"), candidates: free });
  assert.equal(tight.find((r) => r.player.id === "f3").can, false, "ESP would drop to 2");
  assert.equal(tight.find((r) => r.player.id === "f1").can, true);
});

test("who goes: shortlisted players rise within their group", () => {
  const free = [P("f1", "pl"), P("f2", "pl"), P("f3", "pl")];
  const rows = buildSwapList({
    mode: "drop",
    roster: squad(),
    subject: P("a1", "pl"),
    candidates: free,
    shortlistIds: ["f3"],
  });
  assert.equal(rows[0].player.id, "f3");
});

// ---------------------------------------------------------------------------
// Server flows
// ---------------------------------------------------------------------------

const world = { liveCount: 0, frozenRows: [], rpc: {}, rosters: {}, parties: [] };
const roster = (ids, league = "pl") => ids.map((id) => ({ id, name: id, league, club: "C", position: "FWD", seed_metrics: {} }));

function handler(q) {
  if (q.op === "rpc") return world.rpc[q.table.replace("rpc:", "")]?.(q.payload) ?? { data: null, error: null };
  switch (q.table) {
    case "ultima_gameweeks":
      return { data: { number: 4, window_start: "2026-10-29T20:00:00Z", window_end: "2026-11-05T19:59:59Z" } };
    case "ultima_competition":
      return { data: { trade_deadline_gw: null } };
    case "ultima_managers":
      return { data: world.parties };
    case "ultima_untouchables":
      return { data: [], error: null };
    case "ultima_trades":
      if (q.options?.head) {
        return has(q, "in", "state") && has(q, "eq", "proposer_id") && !has(q, "gte", "created_at")
          ? { count: world.liveCount, data: null }
          : { count: 0, data: null };
      }
      return { data: [], error: null };
    case "ultima_trade_players":
      return { data: world.frozenRows, error: null };
    default:
      return { data: [], error: null };
  }
}

let fake = makeFakeDb(handler);
mock.module("@/lib/ultima/server/db", {
  namedExports: { getUltimaDb: () => fake, getManagerCompetitionId: async () => "c1" },
});
mock.module("@/lib/ultima/server/lineup", {
  namedExports: {
    getManagerRoster: async (id) => world.rosters[id] ?? [],
    clearLineupSlots: async () => 0,
    isLeagueLocked: () => false,
    squadLeagueCounts: () => ({}),
    ULTIMA_SQUAD_SIZE: 30,
  },
});
mock.module("@/lib/ultima/server/events", { namedExports: { publishUltimaEvent: () => {} } });
mock.module("@/lib/ultima/server/notify", { namedExports: { notifyTradeProposedAsync: () => {}, notifyManagerOnceAsync: () => {} } });
mock.module("@/lib/ultima/server/scoring-run", { namedExports: { getStandings: async () => [] } });
mock.module("@/lib/ultima/server/record-event", { namedExports: { recordUltimaEvent: async () => {} } });

const { proposeTrade, respondToTrade } = await import("../../lib/ultima/server/trades.js");
const { ULTIMA_ERRORS } = await import("../../lib/ultima/errors.js");

function reset() {
  world.liveCount = 0;
  world.frozenRows = [];
  world.rpc = {};
  world.parties = [
    { id: "m1", is_bot: false, competition_id: "c1" },
    { id: "m2", is_bot: false, competition_id: "c1" },
    { id: "bot", is_bot: true, competition_id: "c1" },
  ];
  world.rosters = {
    m1: roster(["a1", "a2", "a3", "a4"]),
    m2: roster(["b1", "b2", "b3", "b4"]),
    bot: roster(["z1", "z2", "z3", "z4"]),
  };
  fake = makeFakeDb(handler);
}

const send = (over = {}) =>
  proposeTrade({
    competitionId: "c1",
    proposerId: "m1",
    receiverId: "m2",
    givePlayerIds: ["a1"],
    getPlayerIds: ["b1"],
    ...over,
  });

test("propose: the 4th live offer is refused with the plain line", async () => {
  reset();
  world.liveCount = 3;
  const res = await send();
  assert.equal(res.code, "TRADE_CAP");
  assert.equal(ULTIMA_ERRORS.TRADE_CAP, "You have 3 live offers. Withdraw one first.");
  assert.equal(LIVE_CAP_LINE, ULTIMA_ERRORS.TRADE_CAP);
  assert.ok(!fake.log.some((q) => q.table === "ultima_trades" && q.op === "insert"));
});

test("propose: a third live offer still goes through", async () => {
  reset();
  world.liveCount = 2;
  const res = await send();
  assert.notEqual(res.code, "TRADE_CAP");
});

test("propose: no trades with a bot", async () => {
  reset();
  const res = await send({ receiverId: "bot", getPlayerIds: ["z1"] });
  assert.equal(res.code, "TRADE_BOT");
});

test("propose: a player in an accepted deal cannot be asked for", async () => {
  reset();
  world.frozenRows = [{ player_id: "b1", trade_id: "t9", ultima_trades: { state: "review" } }];
  const res = await send();
  assert.equal(res.code, "TRADE_FROZEN");
  assert.equal(res.message ?? ULTIMA_ERRORS.TRADE_FROZEN, "That player is already in an accepted deal.");
});

test("propose: trades work before gameweek 1", async () => {
  reset();
  const noGw = (q) => (q.table === "ultima_gameweeks" ? { data: null } : handler(q));
  fake = makeFakeDb(noGw);
  const res = await send();
  assert.notEqual(res.code, "TRADE_TOO_EARLY");
  assert.notEqual(res.code, "TRADE_DEADLINE");
});

test("propose: a database cap or pair clash from a race ends in the right line", async () => {
  reset();
  const raced = (code, message) => (q) =>
    q.table === "ultima_trades" && q.op === "insert" ? { data: null, error: { code, message } } : handler(q);
  fake = makeFakeDb(raced("P0001", "trade_live_cap"));
  assert.equal((await send()).code, "TRADE_CAP");
  fake = makeFakeDb(raced("23505", "duplicate key"));
  assert.equal((await send()).code, "TRADE_LIVE_OFFER");
});

test("accept: the database result maps to plain lines, a lost race says the player is in an accepted deal", async () => {
  reset();
  const trade = { id: "t1", state: "proposed", proposer_id: "m2", receiver_id: "m1", competition_id: "c1" };
  const answer = (rpcResult) => (q) => {
    if (q.op === "rpc") return rpcResult;
    if (q.table === "ultima_trades" && q.op === "select" && !q.options?.head) return { data: [trade] };
    if (q.table === "ultima_trade_players" && String(q.selected).includes("from_manager_id")) {
      return {
        data: [
          { player_id: "b1", from_manager_id: "m2" },
          { player_id: "a1", from_manager_id: "m1" },
        ],
      };
    }
    return handler(q);
  };
  world.rosters.m2 = roster(["b1", "b2", "b3", "b4"]);

  fake = makeFakeDb(answer({ data: { ok: false, code: "PLAYER_FROZEN" }, error: null }));
  const lost = await respondToTrade({ tradeId: "t1", managerId: "m1", accept: true });
  assert.equal(lost.ok, false);
  assert.equal(lost.code, "TRADE_FROZEN");

  fake = makeFakeDb(answer({ data: { ok: false, code: "EXPIRED" }, error: null }));
  assert.equal((await respondToTrade({ tradeId: "t1", managerId: "m1", accept: true })).code, "TRADE_EXPIRED");

  fake = makeFakeDb(
    answer({ data: { ok: true, review_expires_at: "2026-10-06T10:00:00Z", voided: [{ trade_id: "t2" }] }, error: null }),
  );
  const won = await respondToTrade({ tradeId: "t1", managerId: "m1", accept: true });
  assert.equal(won.ok, true);
  assert.equal(won.state, "review");
  assert.equal(won.voided, 1);
});

test("signing: the database result maps to plain lines, a lost race names the team", async () => {
  const { addDropTransaction } = await import("../../lib/ultima/server/market.js");
  const run = (result) => {
    fake = makeFakeDb((q) => (q.op === "rpc" ? { data: result, error: null } : { data: null, error: null }));
    return addDropTransaction({ managerId: "m1", addPlayerId: "f1", dropPlayerId: "a1", gameweekId: "g1" });
  };
  const taken = await run({ ok: false, code: "PICK_TAKEN", taken_by: "Ajax FC" });
  assert.deepEqual(taken, { ok: false, code: "PICK_TAKEN", message: "Just signed by Ajax FC." });
  const floor = await run({ ok: false, code: "FLOOR_VIOLATION", league: "laliga", count: 2 });
  assert.equal(floor.message, "This leaves you with 2 ESP. You need 3.");
  assert.equal((await run({ ok: false, code: "XV_LOCKED" })).code, "XV_LOCKED");
  assert.equal((await run({ ok: false, code: "IN_ACCEPTED_TRADE" })).code, "IN_ACCEPTED_TRADE");
  const ok = await run({ ok: true, voided: [{ trade_id: "t3" }] });
  assert.deepEqual(ok, { ok: true, voided: 1 });
});

test("card routes gate on requireSeatApi, writes with the write check", async () => {
  const { readFileSync } = await import("node:fs");
  const read = (p) => readFileSync(new URL(`../../app/api/ultima/player/${p}`, import.meta.url), "utf8");
  assert.match(read("action/route.js"), /requireSeatApi\(\{ mutating: true \}\)/);
  assert.match(read("[id]/route.js"), /requireSeatApi\(\)/);
  assert.match(read("[id]/swap/route.js"), /requireSeatApi\(\)/);
});

test("counter: one database call replaces the original, checks run first, the news event follows", async () => {
  reset();
  const original = { id: "t0", state: "proposed", proposer_id: "m2", receiver_id: "m1" };
  const answer = (rpcResult) => (q) => {
    if (q.op === "rpc") return rpcResult;
    if (q.table === "ultima_trades" && q.op === "select" && !q.options?.head) return { data: [original] };
    return handler(q);
  };
  fake = makeFakeDb(answer({ data: { ok: true, trade_id: "t1" }, error: null }));
  const res = await send({ proposerId: "m1", receiverId: "m2", counterOf: "t0" });
  assert.equal(res.ok, true);
  assert.equal(res.tradeId, "t1");
  const rpc = fake.log.find((q) => q.table === "rpc:ultima_counter_trade");
  assert.equal(rpc.payload.p_original_id, "t0");
  assert.deepEqual(rpc.payload.p_give, ["a1"]);
  assert.ok(!fake.log.some((q) => q.table === "ultima_trades" && q.op === "update"), "no separate flip");
  assert.ok(!fake.log.some((q) => q.table === "ultima_trades" && q.op === "insert"), "no separate insert");

  fake = makeFakeDb(answer({ data: { ok: false, code: "NOT_OPEN" }, error: null }));
  assert.equal((await send({ counterOf: "t0" })).ok, false);

  // A failed check never reaches the database call.
  world.liveCount = 3;
  fake = makeFakeDb(answer({ data: { ok: true, trade_id: "t1" }, error: null }));
  assert.equal((await send({ counterOf: "t0" })).code, "TRADE_CAP");
  assert.ok(!fake.log.some((q) => q.table === "rpc:ultima_counter_trade"));
});
