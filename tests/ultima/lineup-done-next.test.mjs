import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { has, makeFakeDb } from "./helpers/fake-db.mjs";

const LEAGUES = ["pl", "laliga", "seriea", "bundesliga", "ligue1"];

const roster = [];
for (const league of LEAGUES) {
  for (let i = 1; i <= 4; i += 1) {
    roster.push({
      id: `${league}${i}`,
      name: `${league}-${i}`,
      club: "C",
      league,
      draft_round: 1,
      bolt_eligible: false,
    });
  }
}

function xvRows(gameweekId) {
  const rows = [];
  let slot = 0;
  for (const league of LEAGUES) {
    for (let i = 1; i <= 3; i += 1) {
      slot += 1;
      rows.push({
        manager_id: "m1",
        gameweek_id: gameweekId,
        slot,
        slot_group: league,
        player_id: `${league}${i}`,
        locked_at: null,
        auto_started: false,
        is_captain: false,
        captain_off: false,
      });
    }
  }
  return rows;
}

const store = { g1: xvRows("g1"), g2: xvRows("g2") };
const upserts = [];
let nextGw = { id: "g2", number: 2, competition_id: "c1" };

const fake = makeFakeDb((q) => {
  if (q.table === "ultima_rosters") {
    return {
      data: roster.map((p) => ({ player_id: p.id, ultima_players: p })),
      error: null,
    };
  }
  if (q.table === "ultima_lineups") {
    if (q.op === "upsert") {
      upserts.push({ ...q.payload });
      const gw = q.payload.gameweek_id;
      store[gw] = store[gw] ?? [];
      const i = store[gw].findIndex((r) => r.slot === q.payload.slot);
      const row = {
        manager_id: "m1",
        locked_at: null,
        auto_started: false,
        is_captain: false,
        captain_off: false,
        ...q.payload,
      };
      if (i >= 0) store[gw][i] = row;
      else store[gw].push(row);
      return { data: null, error: null };
    }
    let gwId = "g1";
    if (has(q, "eq", "gameweek_id", "g2")) gwId = "g2";
    else if (has(q, "eq", "gameweek_id", "g1")) gwId = "g1";
    return { data: [...(store[gwId] ?? [])], error: null };
  }
  return { data: [], error: null };
});

mock.module("@/lib/ultima/server/db", { namedExports: { getUltimaDb: () => fake } });
mock.module("@/lib/ultima/server/events", { namedExports: { publishUltimaEvent: () => {} } });
mock.module("@/lib/ultima/server/record-event", { namedExports: { recordUltimaEvent: async () => {} } });
mock.module("@/lib/ultima/server/matchday-state", {
  namedExports: {
    getGameweekLeagueStates: async () => ({
      states: Object.fromEntries(LEAGUES.map((l) => [l, l === "pl" ? "DONE" : "UPCOMING"])),
      fixtures: [],
    }),
    getLeagueMatchdayState: async () => "DONE",
    seedLeagueIntoNextGameweek: async () => ({ ok: true, seeded: 0 }),
  },
});
mock.module("@/lib/ultima/server/bootstrap", {
  namedExports: {
    getNextGameweek: async () => nextGw,
  },
});

const { saveLineup } = await import("../../lib/ultima/server/lineup.js");

test("edit after DONE writes PL slots to the next gameweek, not the current scored one", async () => {
  upserts.length = 0;
  nextGw = { id: "g2", number: 2, competition_id: "c1" };
  store.g1 = xvRows("g1");
  store.g2 = xvRows("g2");

  const slots = store.g1.map((r) => ({
    slot: r.slot,
    slot_group: r.slot_group,
    player_id: r.slot_group === "pl" && r.slot === 1 ? "pl4" : r.player_id,
  }));

  const res = await saveLineup({
    managerId: "m1",
    gameweekId: "g1",
    gameweek: { id: "g1", number: 1, competition_id: "c1", state: "live" },
    slots,
  });

  assert.equal(res.ok, true);
  assert.equal(res.wroteNext, true);
  assert.equal(res.gameweekId, "g2");
  assert.equal(
    upserts.filter((p) => p.gameweek_id === "g1" && p.slot_group === "pl").length,
    0,
  );
  assert.ok(upserts.some((p) => p.gameweek_id === "g2" && p.slot === 1 && p.player_id === "pl4"));
  assert.equal(store.g1.find((r) => r.slot === 1).player_id, "pl1");
});

test("DONE edit with no next gameweek refuses and does not write", async () => {
  upserts.length = 0;
  nextGw = null;
  store.g1 = xvRows("g1");

  const slots = store.g1.map((r) => ({
    slot: r.slot,
    slot_group: r.slot_group,
    player_id: r.slot_group === "pl" && r.slot === 1 ? "pl4" : r.player_id,
  }));

  const res = await saveLineup({
    managerId: "m1",
    gameweekId: "g1",
    gameweek: { id: "g1", number: 1, competition_id: "c1", state: "live" },
    slots,
  });

  assert.equal(res.ok, false);
  assert.equal(res.code, "NO_NEXT_GAMEWEEK");
  assert.equal(res.message, "Next gameweek not open yet");
  assert.equal(upserts.filter((p) => p.slot_group === "pl").length, 0);
  assert.equal(store.g1.find((r) => r.slot === 1).player_id, "pl1");
});
