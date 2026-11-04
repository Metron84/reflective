import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MATCHDAY_DONE,
  MATCHDAY_LIVE,
  MATCHDAY_LOCKED,
  MATCHDAY_UPCOMING,
  STUCK_FINAL_MS,
  allLeaguesSettled,
  anyLeagueKickoffStarted,
  applyAllLeagueLockOverrides,
  applyLeagueLockOverride,
  computeAllLeagueMatchdayStates,
  computeLeagueMatchdayState,
  isMatchdayLocked,
  lockedLeagueIds,
  planLeagueSeed,
} from "../../lib/ultima/matchday-state.js";
import { nextGameweekState } from "../../lib/ultima/gameweek-state.js";
import { xvSlotLocked } from "../../lib/ultima/lineup/lock.js";
import { lockedLeagues } from "../../lib/ultima/trades/rules.js";

const kick = "2026-10-10T14:00:00Z";
const kickMs = Date.parse(kick);
const fx = (extra = {}) => ({
  league: "pl",
  status: "NS",
  kickoff_at: kick,
  ...extra,
});

test("no fixtures this week: UPCOMING, never LOCKED or LIVE", () => {
  assert.equal(computeLeagueMatchdayState([], kickMs), MATCHDAY_UPCOMING);
  assert.equal(isMatchdayLocked(MATCHDAY_UPCOMING), false);
  assert.equal(xvSlotLocked(MATCHDAY_UPCOMING), false);
  assert.equal(xvSlotLocked(null), false);
});

test("idle league among five: UPCOMING while others can be LIVE", () => {
  const now = kickMs + 60_000;
  const states = computeAllLeagueMatchdayStates(
    [fx({ league: "pl", status: "LIVE" }), fx({ league: "laliga", status: "NS", kickoff_at: "2026-10-11T14:00:00Z" })],
    now,
  );
  assert.equal(states.pl, MATCHDAY_LIVE);
  assert.equal(states.laliga, MATCHDAY_UPCOMING);
  assert.equal(states.seriea, MATCHDAY_UPCOMING);
  assert.equal(states.bundesliga, MATCHDAY_UPCOMING);
  assert.equal(states.ligue1, MATCHDAY_UPCOMING);
  assert.deepEqual(lockedLeagueIds(states), ["pl"]);
});

test("Monday night: LOCKED after kickoff, DONE after FT, lock clears", () => {
  const before = kickMs - 60_000;
  const during = kickMs + 60_000;
  const afterFt = kickMs + 2 * 60 * 60 * 1000;

  assert.equal(computeLeagueMatchdayState([fx({ status: "NS" })], before), MATCHDAY_UPCOMING);
  assert.equal(computeLeagueMatchdayState([fx({ status: "NS" })], during), MATCHDAY_LOCKED);
  assert.equal(computeLeagueMatchdayState([fx({ status: "LIVE" })], during), MATCHDAY_LIVE);
  assert.equal(computeLeagueMatchdayState([fx({ status: "FT" })], afterFt), MATCHDAY_DONE);

  assert.equal(xvSlotLocked(MATCHDAY_LOCKED), true);
  assert.equal(xvSlotLocked(MATCHDAY_LIVE), true);
  assert.equal(xvSlotLocked(MATCHDAY_DONE), false);
  assert.deepEqual(lockedLeagues({ pl: MATCHDAY_DONE, laliga: MATCHDAY_LOCKED }), ["laliga"]);
});

test("midweek round: first kickoff locks; second still NS keeps LOCKED until all final", () => {
  const fri = "2026-10-07T18:00:00Z";
  const wed = "2026-10-14T18:00:00Z";
  const duringFri = Date.parse(fri) + 60_000;
  const afterWedFt = Date.parse(wed) + 3 * 60 * 60 * 1000;
  const rows = [
    fx({ kickoff_at: fri, status: "FT" }),
    fx({ id: "2", kickoff_at: wed, status: "NS" }),
  ];
  assert.equal(computeLeagueMatchdayState(rows, duringFri), MATCHDAY_LOCKED);
  assert.equal(
    computeLeagueMatchdayState(
      [fx({ kickoff_at: fri, status: "FT" }), fx({ id: "2", kickoff_at: wed, status: "FT" })],
      afterWedFt,
    ),
    MATCHDAY_DONE,
  );
});

test("postponed fixture is ignored for locking", () => {
  const now = kickMs + 60_000;
  assert.equal(computeLeagueMatchdayState([fx({ status: "POSTP" })], now), MATCHDAY_UPCOMING);
  assert.equal(
    computeLeagueMatchdayState(
      [fx({ status: "POSTP" }), fx({ id: "2", status: "FT", kickoff_at: kick })],
      now + STUCK_FINAL_MS,
    ),
    MATCHDAY_DONE,
  );
  assert.equal(
    computeLeagueMatchdayState(
      [fx({ status: "CANC" }), fx({ id: "2", status: "LIVE", kickoff_at: kick })],
      now,
    ),
    MATCHDAY_LIVE,
  );
});

test("fixture stuck without a final state counts as final after 4 hours", () => {
  const stuck = kickMs + STUCK_FINAL_MS + 1;
  assert.equal(computeLeagueMatchdayState([fx({ status: "LIVE" })], stuck), MATCHDAY_DONE);
  assert.equal(computeLeagueMatchdayState([fx({ status: "NS" })], stuck), MATCHDAY_DONE);
  assert.equal(computeLeagueMatchdayState([fx({ status: "HT" })], kickMs + STUCK_FINAL_MS - 1), MATCHDAY_LIVE);
});

test("gameweek enters live at first kickoff, provisional when all five DONE or idle", () => {
  const gw = {
    state: "upcoming",
    window_start: "2026-10-09T20:00:00Z",
    window_end: "2026-10-16T19:59:59Z",
  };
  const beforeWindowKick = Date.parse("2026-10-09T21:00:00Z");
  assert.equal(nextGameweekState(gw, [], beforeWindowKick), "upcoming");
  assert.equal(anyLeagueKickoffStarted([], beforeWindowKick), false);

  const fixtures = [fx({ league: "pl", status: "NS" })];
  assert.equal(nextGameweekState(gw, fixtures, kickMs - 1000), "upcoming");
  assert.equal(nextGameweekState(gw, fixtures, kickMs + 1000), "live");

  const done = [fx({ league: "pl", status: "FT" })];
  assert.equal(allLeaguesSettled(done, kickMs + 3 * 60 * 60 * 1000), true);
  assert.equal(
    nextGameweekState({ ...gw, state: "live" }, done, kickMs + 3 * 60 * 60 * 1000),
    "provisional",
  );
});

test("edit-after-DONE target: DONE is not locked so saves can route to next gameweek", () => {
  assert.equal(isMatchdayLocked(MATCHDAY_DONE), false);
  assert.equal(xvSlotLocked(MATCHDAY_DONE), false);
  assert.deepEqual(lockedLeagues({ pl: MATCHDAY_DONE }), []);
});

test("commissioner unlock forces UPCOMING; relock forces LOCKED", () => {
  assert.equal(applyLeagueLockOverride(MATCHDAY_DONE, "unlocked"), MATCHDAY_UPCOMING);
  assert.equal(applyLeagueLockOverride(MATCHDAY_UPCOMING, "locked"), MATCHDAY_LOCKED);
  assert.equal(applyLeagueLockOverride(MATCHDAY_LIVE, null), MATCHDAY_LIVE);
});

test("league_lock_override: empty {} and unknown keys leave computed state alone", () => {
  const computed = {
    pl: MATCHDAY_DONE,
    laliga: MATCHDAY_LIVE,
    seriea: MATCHDAY_LOCKED,
    bundesliga: MATCHDAY_UPCOMING,
    ligue1: MATCHDAY_UPCOMING,
  };
  assert.deepEqual(applyAllLeagueLockOverrides(computed, {}), computed);
  assert.deepEqual(
    applyAllLeagueLockOverrides(computed, { nonsense: "unlocked", plx: "locked" }),
    computed,
  );
  assert.equal(applyLeagueLockOverride(MATCHDAY_DONE, undefined), MATCHDAY_DONE);
  assert.equal(applyLeagueLockOverride(MATCHDAY_DONE, "maybe"), MATCHDAY_DONE);
});

test("seed at DONE: empty next slots copy from current; filled next slots stay", () => {
  const current = [
    { slot: 1, slot_group: "pl", player_id: "pl1", is_captain: true },
    { slot: 2, slot_group: "pl", player_id: "pl2" },
    { slot: 3, slot_group: "pl", player_id: "pl3" },
    { slot: 4, slot_group: "laliga", player_id: "la1" },
  ];
  const next = [
    { slot: 1, slot_group: "pl", player_id: "pl9" }, // already edited
    { slot: 2, slot_group: "pl", player_id: null },
  ];
  const plan = planLeagueSeed({ currentRows: current, nextRows: next, league: "pl" });
  assert.deepEqual(
    plan.map((r) => [r.slot, r.player_id, r.is_captain]),
    [
      [2, "pl2", false],
      [3, "pl3", false],
    ],
  );
});

test("seed at DONE: a manager who never edited n+1 gets the full current league", () => {
  const current = [
    { slot: 1, slot_group: "pl", player_id: "a" },
    { slot: 2, slot_group: "pl", player_id: "b" },
    { slot: 3, slot_group: "pl", player_id: "c" },
  ];
  const plan = planLeagueSeed({ currentRows: current, nextRows: [], league: "pl" });
  assert.deepEqual(
    plan.map((r) => r.player_id),
    ["a", "b", "c"],
  );
});

test("seed at DONE: UPCOMING edits already on current are what get copied", () => {
  // Manager changed PL on GW n while it was still UPCOMING (pl4), then PL went DONE.
  const currentAfterUpcomingEdit = [
    { slot: 1, slot_group: "pl", player_id: "pl4" },
    { slot: 2, slot_group: "pl", player_id: "pl2" },
    { slot: 3, slot_group: "pl", player_id: "pl3" },
  ];
  const plan = planLeagueSeed({
    currentRows: currentAfterUpcomingEdit,
    nextRows: [],
    league: "pl",
  });
  assert.equal(plan[0].player_id, "pl4");
});

test("seed at DONE: player no longer on the squad leaves the slot empty", () => {
  const current = [
    { slot: 1, slot_group: "pl", player_id: "pl1", is_captain: true },
    { slot: 2, slot_group: "pl", player_id: "pl2" },
    { slot: 3, slot_group: "pl", player_id: "traded-away", is_captain: false },
  ];
  const plan = planLeagueSeed({
    currentRows: current,
    nextRows: [],
    league: "pl",
    ownedPlayerIds: ["pl1", "pl2"],
  });
  assert.deepEqual(
    plan.map((r) => [r.slot, r.player_id, r.is_captain]),
    [
      [1, "pl1", true],
      [2, "pl2", false],
      [3, null, false],
    ],
  );
});

test("seed at DONE: captains travel with the slot; filled n+1 slots keep their own", () => {
  const current = [
    { slot: 1, slot_group: "pl", player_id: "pl1", is_captain: true },
    { slot: 2, slot_group: "pl", player_id: "pl2" },
    { slot: 3, slot_group: "pl", player_id: "pl3" },
  ];
  // Manager already set slot 1 on n+1 (no captain). Seed must not overwrite it.
  const next = [{ slot: 1, slot_group: "pl", player_id: "pl9", is_captain: false }];
  const plan = planLeagueSeed({
    currentRows: current,
    nextRows: next,
    league: "pl",
    ownedPlayerIds: ["pl1", "pl2", "pl3"],
  });
  assert.deepEqual(
    plan.map((r) => [r.slot, r.player_id, r.is_captain]),
    [
      [2, "pl2", false],
      [3, "pl3", false],
    ],
  );
});

test("seed at DONE: departed captain does not keep the armband on an empty slot", () => {
  const current = [
    { slot: 1, slot_group: "pl", player_id: "gone", is_captain: true },
    { slot: 2, slot_group: "pl", player_id: "pl2" },
    { slot: 3, slot_group: "pl", player_id: "pl3" },
  ];
  const plan = planLeagueSeed({
    currentRows: current,
    nextRows: [],
    league: "pl",
    ownedPlayerIds: new Set(["pl2", "pl3"]),
  });
  assert.deepEqual(plan.find((r) => r.slot === 1), {
    slot: 1,
    slot_group: "pl",
    player_id: null,
    is_captain: false,
    captain_off: false,
  });
  assert.equal(plan.find((r) => r.slot === 2).is_captain, false);
});
