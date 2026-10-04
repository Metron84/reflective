import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { makeFakeDb } from "./helpers/fake-db.mjs";

// Real draft code runs here. Only the database and the outside world are faked.
const IDS = Array.from({ length: 10 }, (_, i) => `m${i + 1}`);
const LEAGUES = ["pl", "laliga", "seriea", "bundesliga", "ligue1"];
const players = Array.from({ length: 25 }, (_, i) => ({
  id: `p${i + 1}`,
  name: `Player ${i + 1}`,
  club: "Club",
  league: LEAGUES[i % 5],
  provider_id: `x${i + 1}`,
  active: true,
  // p1 is the best player on the board, p5 the weakest.
  seed_metrics: { rating_avg: i === 0 ? 8 : 6.5, goals_rate: i === 0 ? 0.8 : 0.1, assists_rate: 0.1, minutes_reliability: 1 },
}));

let db;
let kind = "season";
let timerSeconds = 60;
let currentPick = 1;
let autoIds = new Set();
let queueIds = [];
let drafted = [];
let draftState = "live";

function freshDb(opts = {}) {
  kind = opts.kind ?? "season";
  timerSeconds = opts.timerSeconds ?? 60;
  currentPick = opts.currentPick ?? 1;
  autoIds = new Set(opts.autoIds ?? []);
  queueIds = opts.queueIds ?? [];
  drafted = [];
  draftState = opts.state ?? "live";
  db = makeFakeDb((q) => {
    if (q.table === "rpc:ultima_claim_draft_pick") {
      const pick = q.payload.p_expected_pick;
      drafted.push({ player_id: q.payload.p_player_id, ultima_players: players.find((p) => p.id === q.payload.p_player_id) });
      currentPick = pick + 1;
      return { data: { ok: true, pickNumber: pick, nextPick: pick + 1, complete: false }, error: null };
    }
    if (q.table === "ultima_players" && q.options?.head) return { count: 600, data: null, error: null };
    if (q.table === "ultima_players" && q.op === "select") return { data: players, error: null };
    if (q.table === "ultima_managers" && q.op === "select") {
      return {
        data: IDS.map((id, i) => ({
          id,
          team_name: id,
          is_bot: false,
          auto_draft: autoIds.has(id),
          draft_slot: i + 1,
          persona_id: null,
          ultima_bot_personas: null,
        })),
        error: null,
      };
    }
    if (q.table === "ultima_competition") return { data: { id: "c1", kind, timer_seconds: timerSeconds }, error: null };
    if (q.table === "ultima_draft_state") {
      return {
        data: { competition_id: "c1", state: draftState, draft_order: IDS, current_pick: currentPick },
        error: null,
      };
    }
    if (q.table === "ultima_draft_queues") {
      return { data: queueIds.map((player_id, position) => ({ player_id, position })), error: null };
    }
    if (q.table === "ultima_draft_picks" && q.selected === "player_id") {
      return { data: q.filters.some((f) => f[0] === "range" && f[1] > 0) ? [] : drafted, error: null };
    }
    return { data: [], error: null };
  });
}
freshDb();

mock.module("@/lib/supabase", { namedExports: { getServiceClient: () => db } });
mock.module("@/lib/ultima/provider/index", {
  namedExports: {
    syncAllPlayersFromProvider: async () => [],
    getStatsProvider: () => ({ fetchPlayers: async () => [], getRankings: () => [] }),
    getProviderName: () => "sportmonks",
    getProviderDiagnostics: () => ({}),
    getProviderStatsCoverage: () => ({}),
  },
});
mock.module("@/lib/ultima/personas", {
  namedExports: { getBotPersonas: () => [{ id: "persona", risk: 0.5, wobble: 0, weights: {} }] },
});
mock.module("@/lib/ultima/server/notify", {
  namedExports: { notifyAutoPickAsync: () => {}, notifyOnClockAsync: () => {} },
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

const { timerForPick, pickClockSeconds } = await import("../../lib/ultima/draft/timer.js");
const { listBotPickCandidates } = await import("../../lib/ultima/bots/pick.js");
const { ULTIMA_TIERED_TIMER_TEXT } = await import("../../lib/ultima/constants.js");
const draft = await import("../../lib/ultima/server/draft.js");
const { commissionerStartDraft, commissionerResumeDraft, commissionerSetTimer } = await import(
  "../../lib/ultima/server/admin.js"
);

const claims = () => db.log.filter((q) => q.table === "rpc:ultima_claim_draft_pick").map((q) => q.payload);
const liveUpdate = () => db.log.find((q) => q.table === "ultima_draft_state" && q.op === "update");
const secondsFromNow = (iso) => Math.round((new Date(iso).getTime() - Date.now()) / 1000);
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) <= 2, `${actual}s is not near ${expected}s`);

test("timerForPick tiers: 90s rounds 1-10, 60s rounds 11-20, 30s rounds 21-30", () => {
  assert.equal(timerForPick(1, 10), 90);
  assert.equal(timerForPick(100, 10), 90);
  assert.equal(timerForPick(101, 10), 60);
  assert.equal(timerForPick(200, 10), 60);
  assert.equal(timerForPick(201, 10), 30);
  assert.equal(timerForPick(300, 10), 30);
});

test("round uses the seat count, not a fixed 10", () => {
  assert.equal(timerForPick(80, 8), 90);
  assert.equal(timerForPick(81, 8), 60);
});

test("practice keeps the competition timer, season ignores it", () => {
  assert.equal(pickClockSeconds({ kind: "practice", timer_seconds: 30 }, 250, 10), 30);
  assert.equal(pickClockSeconds({ kind: "season", timer_seconds: 30 }, 1, 10), 90);
});

test("Start sets a 90s clock on a season draft", async () => {
  freshDb({ state: "lobby" });
  const result = await commissionerStartDraft("c1", "commissioner-user");
  assert.equal(result.ok, true, JSON.stringify(result));
  const live = db.log.find((q) => q.op === "update" && q.payload.state === "live");
  near(secondsFromNow(live.payload.turn_expires_at), 90);
});

test("Start on a practice draft still uses its own timer", async () => {
  freshDb({ kind: "practice", timerSeconds: 45, state: "lobby" });
  await commissionerStartDraft("c1", "commissioner-user");
  const live = db.log.find((q) => q.op === "update" && q.payload.state === "live");
  near(secondsFromNow(live.payload.turn_expires_at), 45);
});

// Pick N hands the clock to pick N + 1: 1 -> 2 is round 1, 100 -> 101 is round 11, 200 -> 201 is round 21.
for (const [pick, want] of [[1, 90], [100, 60], [200, 30]]) {
  test(`claim at pick ${pick} sets the next clock to ${want}s`, async () => {
    freshDb({ currentPick: pick });
    const result = await draft.executePick({
      competitionId: "c1",
      managerId: "m1",
      playerId: "p1",
      options: { skipBotChain: true, skipNotify: true },
    });
    assert.equal(result.ok, true, JSON.stringify(result));
    const [claim] = claims();
    assert.equal(claim.p_expected_pick, pick);
    assert.equal(claim.p_timer_seconds, want);
  });
}

test("claim on practice passes the competition timer, not the tier", async () => {
  freshDb({ kind: "practice", timerSeconds: 45, currentPick: 200 });
  await draft.executePick({
    competitionId: "c1",
    managerId: "m1",
    playerId: "p1",
    options: { skipBotChain: true, skipNotify: true },
  });
  assert.equal(claims()[0].p_timer_seconds, 45);
});

test("claim keeps the 1s clock when the next seat is on auto-draft", async () => {
  freshDb({ currentPick: 100, autoIds: ["m1"] });
  await draft.executePick({
    competitionId: "c1",
    managerId: "m1",
    playerId: "p1",
    options: { skipBotChain: true, skipNotify: true },
  });
  assert.equal(claims()[0].p_timer_seconds, 1);
});

test("resume mid-round 15 (pick 150) sets a 60s clock", async () => {
  freshDb({ currentPick: 150 });
  const result = await commissionerResumeDraft("c1", "commissioner-user", 999);
  assert.equal(result.ok, true);
  near(secondsFromNow(liveUpdate().payload.turn_expires_at), 60);
});

test("resume on practice uses the timer it is given", async () => {
  freshDb({ kind: "practice", currentPick: 150 });
  await commissionerResumeDraft("c1", "commissioner-user", 45);
  near(secondsFromNow(liveUpdate().payload.turn_expires_at), 45);
});

test("set_timer on season returns TIERED_TIMER and changes nothing", async () => {
  freshDb({ currentPick: 5 });
  const result = await commissionerSetTimer("c1", "commissioner-user", 30);
  assert.equal(result.ok, false);
  assert.equal(result.code, "TIERED_TIMER");
  assert.equal(
    db.log.some((q) => q.op === "update" || q.op === "insert"),
    false,
    "no write, so turn_expires_at is untouched",
  );
});

test("set_timer on practice still works", async () => {
  freshDb({ kind: "practice", currentPick: 5 });
  const result = await commissionerSetTimer("c1", "commissioner-user", 60);
  assert.equal(result.ok, true);
  assert.ok(db.log.some((q) => q.table === "ultima_competition" && q.op === "update"));
});

test("draft state at pick 201 reports a 30s clock on season", async () => {
  freshDb({ currentPick: 201 });
  const ctx = await draft.loadDraftContext("c1", { includeAvailable: false });
  assert.equal(ctx.timerSeconds, 30);
  const state = await draft.buildDraftRoomPayload(ctx, { manager: { id: "m2" } });
  assert.equal(state.timer_seconds, 30);
  assert.equal(state.timer_tiered, true);
  assert.equal(state.timer_schedule, ULTIMA_TIERED_TIMER_TEXT);
});

test("draft state on practice reports the competition timer and no schedule", async () => {
  freshDb({ kind: "practice", timerSeconds: 45, currentPick: 201 });
  const ctx = await draft.loadDraftContext("c1", { includeAvailable: false });
  const state = await draft.buildDraftRoomPayload(ctx, { manager: { id: "m2" } });
  assert.equal(state.timer_seconds, 45);
  assert.equal(state.timer_tiered, false);
  assert.equal(state.timer_schedule, null);
});

test("an auto_draft manager on the clock is picked on the advance tick, queue first", async () => {
  // m1 is on the clock at pick 1 with a fresh 90s timer. p5 is queued; p1 is the best player.
  freshDb({ currentPick: 1, autoIds: ["m1"], queueIds: ["p5", "p3"] });
  const result = await draft.advanceDraft("c1", { skipNotify: true });
  assert.equal(result.ok, true, JSON.stringify(result));
  const [claim] = claims();
  assert.ok(claim, "the pick landed with no timer expiry");
  assert.equal(claim.p_manager_id, "m1");
  assert.equal(claim.p_auto_picked, true);
  assert.equal(claim.p_player_id, "p5", "the queued player comes before the highest ranked");
  assert.equal(claim.p_timer_seconds, 90, "next seat is human on the round 1 tier");
});

test("an auto_draft manager with an empty queue falls back to the ranking", async () => {
  freshDb({ currentPick: 1, autoIds: ["m1"], queueIds: [] });
  await draft.advanceDraft("c1", { skipNotify: true });
  assert.equal(claims()[0].p_player_id, "p1");
});

test("queue pick skips a queued player the league floor forbids, then takes the next legal one", () => {
  const pool = ["pl", "laliga", "seriea", "bundesliga", "ligue1"].flatMap((league) => [
    { id: `${league}-a`, league, seed_metrics: {} },
    { id: `${league}-b`, league, seed_metrics: {} },
  ]);
  const rows = listBotPickCandidates({
    persona: { risk: 0.5, wobble: 0, weights: {} },
    availablePlayers: pool,
    // Three picks left and ligue1 still needs three: only ligue1 is legal.
    managerCounts: { pl: 3, laliga: 3, seriea: 3, bundesliga: 3, ligue1: 0 },
    slotsLeft: 3,
    supplyByLeague: { pl: 2, laliga: 2, seriea: 2, bundesliga: 2, ligue1: 2 },
    queuePlayerIds: ["pl-a", "ligue1-b", "ligue1-a"],
  });
  assert.equal(rows[0].player.id, "ligue1-b");
  assert.equal(rows[1].player.id, "ligue1-a");
  assert.ok(rows.every((r) => r.player.league === "ligue1"));
});
