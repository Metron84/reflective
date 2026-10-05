import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { makeFakeDb } from "./helpers/fake-db.mjs";

// The real startDraft and commissionerStartDraft run here. Only the outside world is faked.
const providerCalls = { syncAll: 0, fetchPlayers: 0 };
const lobbyOrder = Array.from({ length: 10 }, (_, i) => ({ id: `m${i + 1}`, draft_slot: i + 1 }));

// Rows come back in a scrambled order, as if the database did not sort them.
const scrambled = [4, 9, 1, 7, 10, 2, 8, 5, 3, 6].map((slot) => ({ id: `m${slot}`, draft_slot: slot }));

let db;
let managers = lobbyOrder;
function freshDb({ draftState = "lobby", seated = lobbyOrder } = {}) {
  managers = seated;
  db = makeFakeDb((q) => {
    if (q.table === "ultima_players" && q.options?.head) return { count: 600, data: null, error: null };
    if (q.table === "ultima_managers" && q.op === "select") {
      return { data: managers.map((m) => ({ ...m, team_name: m.id, is_bot: false, ultima_bot_personas: null })), error: null };
    }
    if (q.table === "ultima_competition") return { data: { id: "c1", timer_seconds: 60 }, error: null };
    if (q.table === "ultima_draft_state") {
      return {
        data: { competition_id: "c1", state: draftState, draft_order: managers.map((m) => m.id), current_pick: 1 },
        error: null,
      };
    }
    return { data: [], error: null };
  });
  providerCalls.syncAll = 0;
  providerCalls.fetchPlayers = 0;
}
freshDb();

mock.module("@/lib/supabase", { namedExports: { getServiceClient: () => db } });
mock.module("@/lib/ultima/provider/index", {
  namedExports: {
    syncAllPlayersFromProvider: async () => {
      providerCalls.syncAll += 1;
      return [];
    },
    getStatsProvider: () => ({
      fetchPlayers: async () => {
        providerCalls.fetchPlayers += 1;
        return [];
      },
      getRankings: () => [],
    }),
    getProviderName: () => "sportmonks",
    getProviderDiagnostics: () => ({}),
    getProviderStatsCoverage: () => ({}),
  },
});
mock.module("@/lib/ultima/personas", { namedExports: { getBotPersonas: () => [] } });
mock.module("@/lib/ultima/server/notify", {
  namedExports: {
    notifyAutoPickAsync: () => {},
    notifyOnClockAsync: () => {},
  },
});
mock.module("@/lib/ultima/bots/seat", { namedExports: { seatBots: async () => ({ ok: true }) } });
for (const spec of ["@/lib/ultima/server/scoring-run", "@/lib/ultima/server/bootstrap"]) {
  mock.module(spec, {
    namedExports: {
      recomputeGameweekScores: async () => ({}),
      bootstrapSampleGameweek: async () => ({ ok: false }),
      getCurrentGameweek: async () => null,
    },
  });
}

process.env.ULTIMA_COMMISSIONER_USER_IDS = "commissioner-user";

const { commissionerStartDraft } = await import("../../lib/ultima/server/admin.js");

test("Start draws the order and begins pick 1, and never calls the Sportmonks sync", async () => {
  freshDb();
  const result = await commissionerStartDraft("c1", "commissioner-user");
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.order.length, 10, "the order is drawn");
  assert.equal(providerCalls.syncAll, 0, "no full sync");
  assert.equal(providerCalls.fetchPlayers, 0, "no league sync");

  const live = db.log.find(
    (q) => q.table === "ultima_draft_state" && q.op === "update" && q.payload.state === "live",
  );
  assert.ok(live, "the draft went live");
  assert.equal(live.payload.current_pick, 1, "pick 1 begins");
  assert.equal(live.payload.draft_order.length, 10);
});

test("Start before the scheduled time still starts (no time lock in the server)", async () => {
  freshDb();
  const result = await commissionerStartDraft("c1", "commissioner-user");
  assert.equal(result.ok, true);
});

test("a non-commissioner cannot start, and nothing is drawn", async () => {
  freshDb();
  const result = await commissionerStartDraft("c1", "someone-else");
  assert.equal(result.ok, false);
  assert.equal(result.code, "NOT_COMMISSIONER");
  assert.equal(db.log.some((q) => q.table === "ultima_draft_state" && q.op === "update"), false);
  assert.equal(providerCalls.syncAll + providerCalls.fetchPlayers, 0);
});

const inSlotOrder = Array.from({ length: 10 }, (_, i) => `m${i + 1}`);
const drawn = () => db.log.find((q) => q.table === "ultima_draft_state" && q.op === "update" && q.payload.state === "live");
const slotWrites = () =>
  db.log
    .filter((q) => q.table === "ultima_managers" && q.op === "update")
    .map((q) => [q.filters.find((f) => f[0] === "eq")[2], q.payload.draft_slot]);

test("Start keeps the lobby order: draft_order is the ids by draft_slot, every time", async () => {
  // A shuffle would match slot order about once in 3.6 million tries per run.
  for (let run = 0; run < 5; run += 1) {
    freshDb({ seated: scrambled });
    const result = await commissionerStartDraft("c1", "commissioner-user");
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.deepEqual(result.order, inSlotOrder);
    assert.deepEqual(drawn().payload.draft_order, inSlotOrder);
  }
});

test("Start writes the same draft_slot values back, so no slot changes", async () => {
  freshDb({ seated: scrambled });
  await commissionerStartDraft("c1", "commissioner-user");
  const writes = slotWrites();
  assert.equal(writes.length, 10);
  for (const [id, slot] of writes) {
    const before = scrambled.find((m) => m.id === id).draft_slot;
    assert.equal(slot, before, `${id} keeps slot ${before}`);
  }
});

test("the draft_started log entry carries the final draft_order", async () => {
  freshDb({ seated: scrambled });
  await commissionerStartDraft("c1", "commissioner-user");
  const entry = db.log.find((q) => q.table === "ultima_admin_log" && q.op === "insert");
  assert.equal(entry.payload.action, "draft_started");
  assert.deepEqual(entry.payload.payload.order, inSlotOrder);
  assert.deepEqual(entry.payload.payload.order, drawn().payload.draft_order, "same list that was stored");
});

for (const [name, seated, why] of [
  ["a seat with no slot", [...lobbyOrder.slice(0, 9), { id: "m10", draft_slot: null }], /no draft slot/],
  ["a duplicate slot", [...lobbyOrder.slice(0, 9), { id: "m10", draft_slot: 9 }], /used twice/],
  ["a gap in the slots", [...lobbyOrder.slice(0, 9), { id: "m10", draft_slot: 11 }], /missing/],
  ["slots that start at 0", lobbyOrder.map((m) => ({ ...m, draft_slot: m.draft_slot - 1 })), /missing|no draft slot|used twice/],
]) {
  test(`Start refuses ${name} and starts nothing`, async () => {
    freshDb({ seated });
    const result = await commissionerStartDraft("c1", "commissioner-user");
    assert.equal(result.ok, false);
    assert.equal(result.code, "SLOTS_INVALID");
    assert.match(result.message, why);
    assert.equal(drawn(), undefined, "the draft did not go live");
    assert.equal(slotWrites().length, 0, "no slot was rewritten");
    assert.equal(db.log.some((q) => q.table === "ultima_admin_log"), false);
  });
}

test("fewer managers than seats is fine when their slots are a clean 1..N", async () => {
  freshDb({ seated: lobbyOrder.slice(0, 4) });
  const result = await commissionerStartDraft("c1", "commissioner-user");
  assert.notEqual(result.code, "SLOTS_INVALID");
});

test("a second Start on a live draft is refused and redraws nothing", async () => {
  freshDb({ draftState: "live" });
  const result = await commissionerStartDraft("c1", "commissioner-user");
  assert.equal(result.ok, false);
  assert.equal(result.code, "DRAFT_STARTED");
  assert.equal(db.log.some((q) => q.table === "ultima_managers" && q.op === "update"), false);
});
