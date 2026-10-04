import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { diffPool } from "../../lib/ultima/pool-diff.js";
import { makeFakeDb } from "./helpers/fake-db.mjs";

const world = { frozen: null, stored: [], picks: 0, fresh: [], calls: { fetchPlayers: [], syncAll: 0 } };
let db;

const row = (id, club, extra = {}) => ({ provider_id: id, name: `Player ${id}`, club, active: true, ...extra });
const stored = (id, club, extra = {}) => ({ id: `uuid-${id}`, provider_id: id, name: `Player ${id}`, club, active: true, ...extra });
const fresh = (id, club, extra = {}) => ({ provider_id: id, name: `Player ${id}`, league: "pl", club, active: true, ...extra });

function reset({ frozen = null, storedRows = [], picks = 0, freshRows = [] } = {}) {
  Object.assign(world, { frozen, stored: storedRows, picks, fresh: freshRows });
  world.calls = { fetchPlayers: [], syncAll: 0 };
  db = makeFakeDb((q) => {
    if (q.table === "ultima_draft_state") {
      return { data: world.frozen ? [{ state: world.frozen }] : [], error: null };
    }
    if (q.table === "ultima_players" && q.op === "select") return { data: world.stored, error: null };
    if (q.table === "ultima_competition") return { data: { id: "season" }, error: null };
    if (q.table === "ultima_draft_picks") return { count: world.picks, data: null, error: null };
    return { data: [], error: null };
  });
}
reset();

mock.module("@/lib/ultima/server/db", { namedExports: { getUltimaDb: () => db } });
mock.module("@/lib/ultima/provider/index", {
  namedExports: {
    getProviderName: () => "sportmonks",
    getProviderDiagnostics: () => ({}),
    getProviderStatsCoverage: () => ({}),
    syncAllPlayersFromProvider: async () => {
      world.calls.syncAll += 1;
      return world.fresh;
    },
    getStatsProvider: () => ({
      fetchPlayers: async (league) => {
        world.calls.fetchPlayers.push(league);
        return world.fresh;
      },
    }),
  },
});

const { syncPlayerPool } = await import("../../lib/ultima/server/players.js");

const writes = () => db.log.filter((q) => ["upsert", "update", "delete", "insert"].includes(q.op));

test("diff: added, changed club, went inactive, and unchanged are counted", () => {
  const d = diffPool({
    existing: [
      row("a", "Arsenal"),
      row("b", "Chelsea"),
      row("c", "Spurs"),
      row("d", "Villa"),
      row("e", "Fulham", { active: false }),
    ],
    fresh: [
      row("a", "Arsenal"),
      row("b", "Newcastle"),
      row("c", "Spurs", { active: false }),
      row("e", "Fulham", { active: true }),
      row("f", "Wolves"),
    ],
  });
  assert.equal(d.added, 1);
  assert.equal(d.changedClub, 1);
  assert.equal(d.unchanged, 1);
  assert.equal(d.reactivated, 1);
  assert.equal(d.wentInactive, 2, "c flagged by the provider, d missing from squads");
  assert.deepEqual(d.samples.changedClub, ["Player b: Chelsea to Newcastle"]);
});

test("sync is frozen while the season draft is live or paused", async () => {
  for (const frozen of ["live", "paused"]) {
    reset({ frozen, freshRows: [fresh("a", "Arsenal")] });
    const result = await syncPlayerPool({ league: "pl" });
    assert.equal(result.ok, false);
    assert.equal(result.error, "draft_in_progress", frozen);
    assert.equal(world.calls.fetchPlayers.length + world.calls.syncAll, 0, "the provider is not called");
    assert.equal(writes().length, 0, "nothing is written");
  }
});

test("the freeze covers a full-pool sync too", async () => {
  reset({ frozen: "live", freshRows: [fresh("a", "Arsenal")] });
  const result = await syncPlayerPool();
  assert.equal(result.error, "draft_in_progress");
  assert.equal(world.calls.syncAll, 0);
});

test("one league per call, with a report of what changed", async () => {
  reset({
    storedRows: [stored("a", "Arsenal"), stored("b", "Chelsea"), stored("c", "Spurs"), stored("d", "Villa")],
    freshRows: [fresh("a", "Arsenal"), fresh("b", "Newcastle"), fresh("c", "Spurs"), fresh("f", "Wolves")],
  });
  const result = await syncPlayerPool({ league: "pl" });
  assert.equal(result.ok, true);
  assert.deepEqual(world.calls.fetchPlayers, ["pl"]);
  assert.equal(world.calls.syncAll, 0);
  assert.equal(result.count, 4);
  assert.equal(result.diff.added, 1);
  assert.equal(result.diff.changedClub, 1);
  assert.equal(result.diff.wentInactive, 1, "d left the squads");

  const upsert = db.log.find((q) => q.op === "upsert");
  assert.equal(upsert.payload.length, 4);
  const deactivate = db.log.find((q) => q.table === "ultima_players" && q.op === "update");
  assert.deepEqual(deactivate.payload, { active: false });
  assert.deepEqual(deactivate.filters.find((f) => f[0] === "in")[2], ["d"]);
  const queueClear = db.log.find((q) => q.table === "ultima_draft_queues" && q.op === "delete");
  assert.deepEqual(queueClear.filters.find((f) => f[0] === "in")[2], ["uuid-d"], "queued players who left are dropped");
});

test("preview reports the same changes and writes nothing", async () => {
  reset({
    storedRows: [stored("a", "Arsenal"), stored("b", "Chelsea")],
    freshRows: [fresh("a", "Arsenal"), fresh("b", "Newcastle")],
  });
  const result = await syncPlayerPool({ league: "pl", dryRun: true });
  assert.equal(result.ok, true);
  assert.equal(result.dryRun, true);
  assert.equal(result.diff.changedClub, 1);
  assert.equal(writes().length, 0);
});

test("a fresh pull far smaller than the stored pool deactivates nobody", async () => {
  const many = Array.from({ length: 10 }, (_, i) => stored(`s${i}`, "Club"));
  reset({ storedRows: many, freshRows: [fresh("s0", "Club")] });
  const result = await syncPlayerPool({ league: "pl" });
  assert.equal(result.ok, true);
  assert.match(result.diff.deactivateSkipped, /under 70%/);
  assert.equal(db.log.some((q) => q.table === "ultima_players" && q.op === "update"), false);
});

test("once the draft has picks, players who left the squads are kept", async () => {
  reset({
    picks: 12,
    storedRows: [stored("a", "Arsenal"), stored("b", "Chelsea"), stored("c", "Spurs"), stored("d", "Villa")],
    freshRows: [fresh("a", "Arsenal"), fresh("b", "Chelsea"), fresh("c", "Spurs")],
  });
  const result = await syncPlayerPool({ league: "pl" });
  assert.match(result.diff.deactivateSkipped, /has picks/);
  assert.equal(db.log.some((q) => q.table === "ultima_players" && q.op === "update"), false);
});

test("an empty provider answer fails loudly and deactivates nobody", async () => {
  reset({ storedRows: [stored("a", "Arsenal")], freshRows: [] });
  const result = await syncPlayerPool({ league: "pl" });
  assert.equal(result.ok, false);
  assert.equal(result.error, "empty_pool");
  assert.equal(writes().length, 0);
});
