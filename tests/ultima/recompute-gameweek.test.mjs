import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { has, makeFakeDb } from "./helpers/fake-db.mjs";

const LEAGUES = ["pl", "laliga", "seriea", "bundesliga", "ligue1"];

const world = {
  statRows: [],
  lineups: [],
  writes: [],
  inserts: [],
  rosterFor: {},
};

// Two managers, GW1 has one fixture. m2 has no lineup rows.
const players = LEAGUES.flatMap((league, l) =>
  [1, 2, 3].map((n) => ({
    id: `${league}${n}`,
    league,
    draft_round: l * 3 + n,
    provider_id: `sm-${league}-${100 + l * 10 + n}`,
    bolt_eligible: false,
  })),
);

const db = makeFakeDb((q) => {
  switch (q.table) {
    case "ultima_players":
      return { data: players, error: null };
    case "ultima_gameweeks":
      if (has(q, "eq", "number")) return { data: { id: "gw1", number: 1 }, error: null };
      return { data: { id: "gw1", number: 1, competition_id: "c", state: "final" }, error: null };
    case "ultima_fixtures":
      return { data: [{ id: "f1", status: "FT", gameweek_id: "gw1" }], error: null };
    case "ultima_player_match_stats": {
      if (q.op === "update") {
        const row = world.statRows.find((r) => r.id === q.filters.find((f) => f[0] === "eq" && f[1] === "id")[2]);
        if (row) row.player_id = q.payload.player_id;
        return { data: [{ id: row?.id }], error: null };
      }
      if (has(q, "is", "player_id", null)) {
        world.nullQuery = q;
        return { data: world.statRows.filter((r) => r.player_id == null), error: null };
      }
      if (has(q, "not", "player_id")) return { data: [], error: null };
      return { data: world.statRows.filter((r) => r.player_id), error: null };
    }
    case "ultima_managers":
      return {
        data: [
          { id: "m1", team_name: "Alpha" },
          { id: "m2", team_name: "Beta" },
        ],
        error: null,
      };
    case "ultima_rosters":
      return { data: players.map((p) => ({ player_id: p.id, ultima_players: p })), error: null };
    case "ultima_competition":
      return { data: { rating_thresholds: {} }, error: null };
    case "ultima_lineups":
      if (q.op === "insert") {
        world.inserts.push(q.payload);
        world.lineups.push(...q.payload);
        return { data: null, error: null };
      }
      if (q.op === "update") return { data: null, error: null };
      if (has(q, "eq", "is_captain", true)) return { data: [], error: null };
      return { data: world.lineups, error: null };
    case "ultima_manager_gameweek_scores":
      world.writes.push(q.payload);
      return { data: null, error: null };
    default:
      return { data: [], error: null };
  }
});
mock.module("@/lib/ultima/server/db", {
  namedExports: {
    getUltimaDb: () => db,
    getActiveCompetition: async () => ({ id: "c" }),
    isCommissionerUser: () => false,
    isUltimaCommissioner: async () => false,
  },
});
mock.module("next/server", {
  namedExports: {
    NextResponse: { json: (body, init = {}) => ({ body, status: init.status ?? 200 }) },
  },
});
mock.module("@/lib/ultima/server/record-event", { namedExports: { recordUltimaEvent: async () => {} } });

const { linkNullStatPlayers, loadPlayerIndex } = await import("../../lib/ultima/server/link-stats.js");
const { autoStartUnsetLineups } = await import("../../lib/ultima/server/auto-start-lineups.js");
const { recomputeGameweekByNumber } = await import("../../lib/ultima/server/recompute-gameweek.js");

function reset() {
  world.statRows = [
    { id: "s1", fixture_id: "f1", sportmonks_player_id: 101, player_id: null, goals: 1, rating: 7 },
    { id: "s2", fixture_id: "f1", sportmonks_player_id: 999999, player_id: null, goals: 0, rating: 6 },
  ];
  world.lineups = [];
  world.writes = [];
  world.inserts = [];
}
const lineupRow = (manager, slot, group, playerId) => ({
  manager_id: manager, slot, slot_group: group, player_id: playerId, is_captain: false,
});

test("id match: stat row links by the third provider_id field, unmatched stays null", async () => {
  reset();
  const loaded = await loadPlayerIndex(db);
  const result = await linkNullStatPlayers(db, { index: loaded.index, fixtureIds: ["f1"] });
  assert.equal(result.linked, 1);
  assert.equal(world.statRows[0].player_id, "pl1");
  assert.equal(world.statRows[1].player_id, null);
  assert.ok(has(world.nullQuery, "in", "fixture_id", ["f1"]));
});

test("auto-start: only a manager with no lineup gets 15 players, 3 per league, flagged", async () => {
  reset();
  world.lineups = [lineupRow("m1", 1, "pl", "pl1")];
  const out = await autoStartUnsetLineups(db, "gw1");
  assert.equal(out.started, 1);
  const rows = world.inserts[0];
  assert.equal(rows.length, 15);
  assert.ok(rows.every((r) => r.manager_id === "m2" && r.auto_started === true));
  for (const league of LEAGUES) {
    assert.equal(rows.filter((r) => r.slot_group === league).length, 3);
  }
  // draft order: lowest draft_round players first
  assert.deepEqual(
    rows.filter((r) => r.slot_group === "pl").map((r) => r.player_id),
    ["pl1", "pl2", "pl3"],
  );
});

test("recompute: links, auto-starts, then returns points and captain bonus per manager", async () => {
  reset();
  world.lineups = [lineupRow("m1", 1, "pl", "pl1")];
  const result = await recomputeGameweekByNumber(1);
  assert.equal(result.ok, true);
  assert.equal(result.rows_linked, 1);
  assert.equal(result.lineups_autostarted, 1);
  assert.deepEqual(result.managers.map((m) => m.team_name), ["Alpha", "Beta"]);
  for (const m of result.managers) {
    assert.equal(typeof m.points, "number");
    assert.equal(typeof m.captain_bonus, "number");
  }
  assert.equal(world.writes.length, 2);
});

test("recompute: rejects a bad gameweek number", async () => {
  const result = await recomputeGameweekByNumber("abc");
  assert.equal(result.ok, false);
  assert.equal(result.code, "INVALID");
});

const { POST } = await import("../../app/api/ultima/admin/recompute/route.js");
const call = (headers, body) =>
  POST(new Request("http://x/api/ultima/admin/recompute", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  }));

test("route: refuses without the cron secret, accepts with it", async () => {
  process.env.ULTIMA_CRON_SECRET = "test-secret-not-real";
  reset();
  world.lineups = [lineupRow("m1", 1, "pl", "pl1")];
  assert.equal((await call({}, { gameweek: 1 })).status, 401);
  assert.equal((await call({ "x-cron-secret": "wrong" }, { gameweek: 1 })).status, 401);
  const ok = await call({ "x-cron-secret": "test-secret-not-real" }, { gameweek: 1 });
  assert.equal(ok.status, 200);
  const json = ok.body;
  assert.equal(json.lineups_autostarted, 1);
  assert.ok(Array.isArray(json.managers));
  assert.equal((await call({ "x-cron-secret": "test-secret-not-real" }, { gameweek: "x" })).status, 400);
  delete process.env.ULTIMA_CRON_SECRET;
});
