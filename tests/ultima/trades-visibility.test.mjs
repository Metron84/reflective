import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { readFileSync } from "node:fs";
import { makeFakeDb } from "./helpers/fake-db.mjs";

// Columns that exist on public.ultima_players in production. There is no
// position column. PostgREST fails a select that names one.
const PLAYER_COLUMNS = new Set([
  "id", "name", "league", "club", "bolt_eligible", "seed_metrics", "on_loan", "parent_club",
  "provider_id", "active", "inactive_flag", "draft_round",
]);

const COMP = "c1";
const TRF = "m-trf";
const ABCDE = "m-abcde";
const CITY = "m-city";

const player = (id, name, league = "pl") => ({ id, name, league, club: "C", bolt_eligible: false, seed_metrics: {} });
const now = Date.now();

// ABCDE FC proposed to TRF. TRF proposed to FC City of Light. Both live.
const trades = [
  {
    id: "t-in", competition_id: COMP, state: "proposed", proposer_id: ABCDE, receiver_id: TRF,
    created_at: new Date(now - 30 * 60_000).toISOString(),
    ultima_trade_players: [
      { player_id: "p1", from_manager_id: ABCDE, to_manager_id: TRF, ultima_players: player("p1", "Saka") },
      { player_id: "p2", from_manager_id: TRF, to_manager_id: ABCDE, ultima_players: player("p2", "Pedri", "laliga") },
    ],
  },
  {
    id: "t-out", competition_id: COMP, state: "proposed", proposer_id: TRF, receiver_id: CITY,
    created_at: new Date(now - 3 * 3_600_000).toISOString(),
    ultima_trade_players: [
      { player_id: "p3", from_manager_id: TRF, to_manager_id: CITY, ultima_players: player("p3", "Haaland") },
      { player_id: "p4", from_manager_id: CITY, to_manager_id: TRF, ultima_players: player("p4", "Kane", "bundesliga") },
    ],
  },
];

const managers = [
  { id: TRF, team_name: "TRF", manager_name: "Melo", colour: "slate", is_bot: false },
  { id: ABCDE, team_name: "ABCDE FC", manager_name: "A", colour: "slate", is_bot: false },
  { id: CITY, team_name: "FC City of Light", manager_name: "C", colour: "slate", is_bot: false },
];

/** Answers like PostgREST: a select that names a missing column is an error. */
function handler(q) {
  if (q.table === "ultima_trades" && q.op === "select" && typeof q.selected === "string") {
    const join = q.selected.match(/ultima_players\(([^)]*)\)/);
    const asked = (join?.[1] ?? "").split(",").map((c) => c.trim()).filter(Boolean);
    const missing = asked.filter((c) => !PLAYER_COLUMNS.has(c));
    if (missing.length) return { data: null, error: { message: `column ultima_players_1.${missing[0]} does not exist` } };
    if (q.filters.some((f) => f[0] === "or")) return { data: [], error: null }; // settle sweep
    return { data: trades.filter((t) => q.filters.every((f) => f[0] !== "in" || f[2].includes(t.state))), error: null };
  }
  if (q.table === "ultima_managers") return { data: managers, error: null };
  if (q.table === "ultima_trades") return { data: [], error: null };
  return { data: [], error: null };
}

const fake = makeFakeDb(handler);
fake.rpc = async () => ({ data: { expired: [] }, error: null });

mock.module("@/lib/ultima/server/db", { namedExports: { getUltimaDb: () => fake, getManagerCompetitionId: async () => COMP } });
mock.module("@/lib/ultima/server/lineup", { namedExports: { getManagerRoster: async () => [] } });
mock.module("@/lib/ultima/server/events", { namedExports: { publishUltimaEvent: () => {} } });
mock.module("@/lib/ultima/server/notify", { namedExports: { notifyTradeProposedAsync: () => {} } });
mock.module("@/lib/ultima/server/notifications", {
  namedExports: {
    notifyExpiredTrades: async () => {}, notifyOfferAnswered: async () => {}, notifyOfferReceived: async () => {},
    notifyTradeInReview: async () => {}, notifyTradeSettled: async () => {}, notifyVoidedTrades: async () => {},
  },
});
mock.module("@/lib/ultima/server/untouchables", {
  namedExports: { listManagerUntouchables: async () => [], listUntouchables: async () => ({}) },
});
mock.module("@/lib/ultima/server/record-event", { namedExports: { recordUltimaEvent: async () => {} } });
mock.module("@/lib/ultima/server/scoring-run", { namedExports: { getStandings: async () => [] } });
mock.module("@/lib/ultima/server/trade-block", {
  namedExports: { buildTradeBoard: async () => ({ inbox: [], untouchable: {} }) },
});

const { getTradeOffice, listHubTradeCards } = await import("../../lib/ultima/server/trades.js");

test("a proposed trade shows for the receiver under Received, with both sides and an expiry", async () => {
  const office = await getTradeOffice({ competitionId: COMP, managerId: TRF });
  const incoming = office.received.find((o) => o.id === "t-in");
  assert.ok(incoming, "received holds the offer from ABCDE FC");
  assert.equal(incoming.state, "proposed");
  assert.deepEqual(incoming.youGive.map((p) => p.name), ["Pedri"]);
  assert.deepEqual(incoming.youGet.map((p) => p.name), ["Saka"]);
  assert.match(incoming.expiresIn, /47h/);
  assert.equal(incoming.canAccept, true);
  assert.equal(incoming.canDecline, true);
  assert.equal(incoming.canCancel, false);
});

test("a proposed trade shows for the proposer under Sent, with a cancel", async () => {
  const office = await getTradeOffice({ competitionId: COMP, managerId: TRF });
  const outgoing = office.sent.find((o) => o.id === "t-out");
  assert.ok(outgoing, "sent holds the offer to FC City of Light");
  assert.deepEqual(outgoing.youGive.map((p) => p.name), ["Haaland"]);
  assert.deepEqual(outgoing.youGet.map((p) => p.name), ["Kane"]);
  assert.equal(outgoing.canCancel, true);
  assert.equal(outgoing.canAccept, false);

  const abcde = await getTradeOffice({ competitionId: COMP, managerId: ABCDE });
  assert.deepEqual(abcde.sent.map((o) => o.id), ["t-in"]);
  assert.equal(abcde.received.length, 0);
  const city = await getTradeOffice({ competitionId: COMP, managerId: CITY });
  assert.deepEqual(city.received.map((o) => o.id), ["t-out"]);
});

test("the office select only names player columns that exist", () => {
  const src = readFileSync(new URL("../../lib/ultima/server/trades.js", import.meta.url), "utf8");
  for (const [, cols] of src.matchAll(/ultima_players\(([^)]*)\)/g)) {
    for (const col of cols.split(",").map((c) => c.trim())) {
      assert.ok(PLAYER_COLUMNS.has(col), `ultima_players has no column ${col}`);
    }
  }
});

test("a failed trades read throws, it does not pass for no offers", async () => {
  const original = fake.from;
  fake.from = (table) => {
    const b = original(table);
    if (table !== "ultima_trades") return b;
    const select = b.select;
    b.select = (cols, opts) => select(String(cols).replace("bolt_eligible", "position"), opts);
    return b;
  };
  try {
    await assert.rejects(getTradeOffice({ competitionId: COMP, managerId: TRF }), /could not be read/);
  } finally {
    fake.from = original;
  }
});

test("the Hub trade desk shows a live offer to both the receiver and the proposer", async () => {
  const receiver = await listHubTradeCards(COMP, TRF);
  const byId = Object.fromEntries(receiver.map((c) => [c.id, c]));
  assert.equal(byId["t-in"].can_accept, true);
  assert.equal(byId["t-in"].can_cancel, false);
  assert.equal(byId["t-out"].can_cancel, true);
  assert.deepEqual(byId["t-in"].giving, ["Saka"]);
  assert.deepEqual(byId["t-in"].getting, ["Pedri"]);
  assert.match(byId["t-in"].expires_in, /47h/);

  const stranger = await listHubTradeCards(COMP, "m-other");
  assert.equal(stranger.length, 0, "a live offer between two other clubs stays off the desk");
});
