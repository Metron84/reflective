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
  computeAllLeagueMatchdayStates,
  computeLeagueMatchdayState,
  isMatchdayLocked,
  lockedLeagueIds,
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
