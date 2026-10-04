import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { makeFakeDb } from "./helpers/fake-db.mjs";

// The real startDraft and commissionerStartDraft run here. Only the outside world is faked.
const providerCalls = { syncAll: 0, fetchPlayers: 0 };
const managers = Array.from({ length: 10 }, (_, i) => ({ id: `m${i + 1}`, draft_slot: i + 1 }));

let db;
function freshDb({ draftState = "lobby" } = {}) {
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

test("a second Start on a live draft is refused and redraws nothing", async () => {
  freshDb({ draftState: "live" });
  const result = await commissionerStartDraft("c1", "commissioner-user");
  assert.equal(result.ok, false);
  assert.equal(result.code, "DRAFT_STARTED");
  assert.equal(db.log.some((q) => q.table === "ultima_managers" && q.op === "update"), false);
});
