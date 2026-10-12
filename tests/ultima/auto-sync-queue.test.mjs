import assert from "node:assert/strict";
import test from "node:test";
import {
  fixtureNeedsStatusRefresh,
  fixtureNeedsUnscored,
  isNonPlayingRaw,
  mergeScoreQueue,
  nextScoreQueue,
  prepareAutoSyncBatch,
  settlePendingRescores,
  storedStatusForRemote,
  upsertPlayerScores,
} from "../../lib/ultima/auto-sync-select.js";

const day = 24 * 60 * 60 * 1000;

test("a not-started fixture is refreshed to full time and queued for scoring in the same run", async () => {
  const now = new Date("2026-10-12T20:00:00Z");
  const kickoff = new Date(now.getTime() - 2 * day).toISOString();
  let scoredStatus = null;
  const result = await prepareAutoSyncBatch({
    fixtures: [{
      id: "fx-old",
      league: "pl",
      status: "NS",
      kickoff_at: kickoff,
      gameweek_id: "gw-old",
      sportmonks_fixture_id: 99,
    }],
    statCounts: new Map(),
    currentGameweekId: "gw-now",
    now,
    fetchStatus: async (fixture) => {
      scoredStatus = fixture.status;
      return { status: "FT", home_score: 2, away_score: 1 };
    },
    savedQueue: [],
  });

  assert.equal(scoredStatus, "NS");
  assert.equal(result.skipScoring, false);
  assert.equal(result.statusRefreshed, 1);
  assert.equal(result.fixtures.get("fx-old").status, "FT");
  assert.equal(result.batch.length, 1);
  assert.equal(result.batch[0].id, "fx-old");
  assert.equal(result.batch[0].status, "FT");
});

test("full time without stats_final stays queued, including when rows already exist", () => {
  assert.equal(fixtureNeedsUnscored({ league: "pl", status: "FT", stats_final: false }, 0), true);
  assert.equal(fixtureNeedsUnscored({ league: "pl", status: "FT", stats_final: false }, 12), true);
  assert.equal(fixtureNeedsUnscored({ league: "pl", status: "FT", stats_final: true }, 12), false);
  assert.equal(fixtureNeedsUnscored({ league: "pl", status: "LIVE" }, 4), true);
  assert.equal(fixtureNeedsUnscored({ league: "pl", status: "NS" }, 0), false);
});

test("a fixture scored while live is rescored at full time without doubling points", async () => {
  const now = new Date("2026-10-12T20:00:00Z");
  const kickoff = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
  const base = {
    id: "fx",
    league: "pl",
    kickoff_at: kickoff,
    gameweek_id: "gw",
    stats_final: false,
  };
  const livePass = await prepareAutoSyncBatch({
    fixtures: [{ ...base, status: "LIVE" }],
    statCounts: new Map([["fx", 0]]),
    currentGameweekId: "gw",
    now,
    fetchStatus: async () => null,
  });
  assert.equal(livePass.batch[0].status, "LIVE");
  const afterLive = nextScoreQueue(livePass.queue, [{ id: "fx", status: "LIVE", ok: true }]);
  assert.deepEqual(afterLive, ["fx"]);

  const liveRows = [{ fixture_id: "fx", player_id: "p1", goals: 1, assists: 0 }];
  const ftPass = await prepareAutoSyncBatch({
    fixtures: [{ ...base, status: "FT" }],
    statCounts: new Map([["fx", liveRows.length]]),
    currentGameweekId: "gw",
    now,
    savedQueue: afterLive,
    fetchStatus: async () => null,
  });
  assert.equal(ftPass.batch[0].status, "FT");

  const finalRows = upsertPlayerScores(liveRows, [
    { fixture_id: "fx", player_id: "p1", goals: 1, assists: 1 },
  ]);
  assert.equal(finalRows.length, 1);
  const points = finalRows[0].goals * 3 + finalRows[0].assists;
  assert.equal(points, 4);

  const afterFinal = nextScoreQueue(ftPass.queue, [{ id: "fx", status: "FT", ok: true }]);
  assert.deepEqual(afterFinal, []);
  assert.equal(fixtureNeedsUnscored({ ...base, status: "FT", stats_final: true }, 1), false);
});

test("status refresh only includes kickoffs that have passed and are not full time", () => {
  const now = new Date("2026-10-12T20:00:00Z");
  const past = new Date(now.getTime() - day).toISOString();
  const future = new Date(now.getTime() + day).toISOString();
  assert.equal(fixtureNeedsStatusRefresh({ league: "pl", status: "NS", kickoff_at: past }, now), true);
  assert.equal(fixtureNeedsStatusRefresh({ league: "pl", status: null, kickoff_at: past }, now), true);
  assert.equal(fixtureNeedsStatusRefresh({ league: "pl", status: "LIVE", kickoff_at: past }, now), true);
  assert.equal(fixtureNeedsStatusRefresh({ league: "pl", status: "FT", kickoff_at: past }, now), false);
  assert.equal(fixtureNeedsStatusRefresh({ league: "pl", status: "NS", kickoff_at: future }, now), false);
});

test("a refresh that exceeds 4 seconds skips scoring", async () => {
  const now = new Date("2026-10-12T20:00:00Z");
  const kickoff = new Date(now.getTime() - day).toISOString();
  const result = await prepareAutoSyncBatch({
    fixtures: [{ id: "fx", league: "pl", status: "NS", kickoff_at: kickoff, gameweek_id: "gw" }],
    now,
    refreshBudgetMs: -1,
    fetchStatus: async () => ({ status: "FT" }),
  });
  assert.equal(result.skipScoring, true);
  assert.equal(result.batch.length, 0);
});

test("the score queue advances and does not rewind", () => {
  const first = mergeScoreQueue([], ["a", "b", "c", "d"]);
  const next = mergeScoreQueue(first.slice(3), ["d", "e"]);
  assert.deepEqual(next, ["d", "e"]);
});

test("remaining falls only by fixtures that were actually scored", () => {
  const saved = Array.from({ length: 40 }, (_, i) => `fx-${i}`);
  const merged = mergeScoreQueue(saved, ["fx-0"]);
  assert.equal(merged.length, 40);
  const after = nextScoreQueue(merged, [{ id: "fx-0", status: "FT", ok: true }]);
  assert.equal(after.length, 39);
  assert.equal(after.includes("fx-0"), false);
  assert.equal(after[0], "fx-1");
});

test("budget order is pending rescore, then status refresh, then scoring", async () => {
  const order = [];
  const settled = await settlePendingRescores(["gw-1"], async () => {
    order.push("rescore");
  });
  assert.deepEqual(settled.pending, []);
  const now = new Date("2026-10-12T20:00:00Z");
  const past = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const planned = await prepareAutoSyncBatch({
    fixtures: [{
      id: "fx-0",
      league: "pl",
      status: "NS",
      kickoff_at: past,
      gameweek_id: "gw-1",
    }],
    statCounts: new Map(),
    currentGameweekId: "gw-1",
    now,
    fetchStatus: async () => {
      order.push("refresh");
      return { status: "FT", raw_status: "FT" };
    },
    savedQueue: Array.from({ length: 40 }, (_, i) => `fx-${i}`),
    scoreBatchSize: 1,
  });
  if (!planned.skipScoring && planned.batch.length) order.push("score");
  assert.deepEqual(order, ["rescore", "refresh", "score"]);
  const kept = await settlePendingRescores(["gw-2"], async () => {
    throw new Error("no");
  });
  assert.deepEqual(kept.pending, ["gw-2"]);
  const after = nextScoreQueue(planned.queue, [{ id: "fx-0", status: "FT", ok: true }]);
  assert.equal(after.length, 39);
  assert.equal(planned.queue.length, 40);
});

test("postponed fixtures are stored and not refreshed again, and an unchanged status waits 30 minutes", () => {
  const now = new Date("2026-10-12T20:00:00Z");
  const past = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(isNonPlayingRaw("postponed"), true);
  assert.equal(isNonPlayingRaw("cancelled"), true);
  assert.equal(isNonPlayingRaw("abandoned"), true);
  assert.equal(isNonPlayingRaw("ABAN"), true);
  assert.equal(isNonPlayingRaw("2nd"), false);
  assert.equal(storedStatusForRemote("postponed"), "POSTP");
  assert.equal(storedStatusForRemote("ABAN"), "CANC");
  assert.equal(storedStatusForRemote("2nd"), "LIVE");
  assert.equal(
    fixtureNeedsStatusRefresh({ league: "pl", status: "POSTP", kickoff_at: past }, now),
    false,
  );
  const recent = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  assert.equal(
    fixtureNeedsStatusRefresh(
      { league: "pl", status: "NS", kickoff_at: past },
      now,
      { unchangedAt: recent },
    ),
    false,
  );
  const old = new Date(now.getTime() - 31 * 60 * 1000).toISOString();
  assert.equal(
    fixtureNeedsStatusRefresh(
      { league: "pl", status: "NS", kickoff_at: past },
      now,
      { unchangedAt: old },
    ),
    true,
  );
});
