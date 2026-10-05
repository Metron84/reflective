import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkIdLists,
  countVetoes,
  floorMessage,
  floorShortfall,
  isDue,
  lockedLeagues,
  tradeGate,
  vetoMajority,
  vetoReached,
} from "../../lib/ultima/trades/rules.js";

const p = (id, league) => ({ id, league });
const squad = () => [
  ...["a1", "a2", "a3", "a4"].map((id) => p(id, "pl")),
  ...["b1", "b2", "b3", "b4"].map((id) => p(id, "laliga")),
  ...["c1", "c2", "c3", "c4"].map((id) => p(id, "seriea")),
  ...["d1", "d2", "d3", "d4"].map((id) => p(id, "bundesliga")),
  ...["e1", "e2", "e3", "e4"].map((id) => p(id, "ligue1")),
];

test("trade gate: trades are open now, before gameweek 1 included", () => {
  assert.deepEqual(tradeGate({ gw: null }), { ok: true });
  assert.deepEqual(tradeGate({ gw: undefined, deadlineGw: 20 }), { ok: true });
  assert.equal(tradeGate({ gw: { number: 1 } }).ok, true);
  assert.equal(tradeGate({ gw: { number: 3 } }).ok, true);
  assert.equal(tradeGate({ gw: { number: 30 } }).ok, true);
});

test("trade gate: deadline closes the window after its gameweek", () => {
  assert.equal(tradeGate({ gw: { number: 8 }, deadlineGw: 8 }).ok, true);
  assert.deepEqual(tradeGate({ gw: { number: 9 }, deadlineGw: 8 }), { ok: false, code: "TRADE_DEADLINE" });
});

test("trade gate: a null deadline means none, and a deadline of 4 is a real deadline", () => {
  assert.equal(tradeGate({ gw: { number: 12 }, deadlineGw: null }).ok, true);
  assert.equal(tradeGate({ gw: { number: 12 }, deadlineGw: undefined }).ok, true);
  assert.equal(tradeGate({ gw: { number: 4 }, deadlineGw: 4 }).ok, true);
  assert.deepEqual(tradeGate({ gw: { number: 5 }, deadlineGw: 4 }), { ok: false, code: "TRADE_DEADLINE" });
});

test("id lists: no 0 for 0, no duplicates, equal sides", () => {
  assert.equal(checkIdLists([], []).code, "TRADE_EMPTY");
  assert.equal(checkIdLists(["a"], []).code, "TRADE_EMPTY");
  assert.equal(checkIdLists(["a", "a"], ["b", "c"]).code, "TRADE_DUPLICATE");
  assert.equal(checkIdLists(["a"], ["a"]).code, "TRADE_DUPLICATE");
  assert.equal(checkIdLists(["a", "b"], ["c"]).code, "TRADE_UNEVEN");
  assert.equal(checkIdLists(["a", "b"], ["c", "d"]).ok, true);
  assert.equal(checkIdLists(undefined, undefined).code, "TRADE_EMPTY");
});

test("floor: names the league and the count", () => {
  const roster = squad();
  const short = floorShortfall(roster, ["c1", "c2"], [p("x1", "pl"), p("x2", "pl")]);
  assert.deepEqual(short, { league: "seriea", count: 2, floor: 3 });
  assert.equal(floorMessage(short), "This leaves you with 2 ITA. You need 3.");
  assert.equal(
    floorMessage(short, { you: false, team: "Doumani Athletic" }),
    "This leaves Doumani Athletic with 2 ITA. They need 3.",
  );
});

test("floor: a swap that keeps 3 per league passes", () => {
  assert.equal(floorShortfall(squad(), ["a1", "b1"], [p("x1", "pl"), p("x2", "laliga")]), null);
  assert.equal(floorShortfall(squad(), ["a1"], [p("x1", "laliga")]), null);
});

test("floor: an existing shortfall is allowed; deepening it is not", () => {
  const short = squad().filter((row) => row.id !== "a3" && row.id !== "a4");
  assert.equal(short.filter((r) => r.league === "pl").length, 2);
  assert.equal(floorShortfall(short, ["a1"], [p("x1", "pl")]), null);
  assert.deepEqual(floorShortfall(short, ["a1"], []), { league: "pl", count: 1, floor: 3 });
});

test("veto majority of other human managers", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8].map(vetoMajority), [1, 2, 2, 3, 3, 4, 4, 5]);
});

test("veto count: rows per manager, parties and bots never count", () => {
  const eligible = ["m3", "m4", "m5"];
  const votes = [
    { manager_id: "m3", veto: true },
    { manager_id: "m3", veto: true },
    { manager_id: "m1", veto: true },
    { manager_id: "bot", veto: true },
    { manager_id: "m4", veto: false },
  ];
  assert.equal(countVetoes(votes, eligible), 1);
  assert.equal(vetoReached(votes, eligible), false);
  assert.equal(vetoReached([...votes, { manager_id: "m5", veto: true }], eligible), true);
});

test("veto: nobody else to vote means no veto", () => {
  assert.equal(vetoReached([], []), false);
  assert.equal(vetoReached([{ manager_id: "m1", veto: true }], []), false);
});

test("locks: a league is locked from its first kickoff to the window end", () => {
  const gw = {
    window_end: "2026-10-08T19:59:00Z",
    league_open_at: { pl: "2026-10-03T11:30:00Z", laliga: "2026-10-04T10:00:00Z" },
  };
  const now = Date.parse("2026-10-03T12:00:00Z");
  assert.deepEqual(lockedLeagues(gw, now), ["pl"]);
  assert.deepEqual(lockedLeagues(gw, Date.parse("2026-10-04T12:00:00Z")), ["pl", "laliga"]);
  assert.deepEqual(lockedLeagues(gw, Date.parse("2026-10-09T00:00:00Z")), []);
  assert.deepEqual(lockedLeagues({ league_open_at: null }, now), []);
});

test("due: review and hold end at their own timestamps", () => {
  const now = Date.parse("2026-10-05T12:00:00Z");
  assert.equal(isDue({ state: "review", review_expires_at: "2026-10-05T11:00:00Z" }, now), true);
  assert.equal(isDue({ state: "review", review_expires_at: "2026-10-05T13:00:00Z" }, now), false);
  assert.equal(isDue({ state: "awaiting_unlock", unlock_at: "2026-10-05T11:00:00Z" }, now), true);
  assert.equal(isDue({ state: "awaiting_unlock", unlock_at: null }, now), false);
  assert.equal(isDue({ state: "proposed", review_expires_at: "2020-01-01T00:00:00Z" }, now), false);
});

import {
  acceptTooLate,
  findBusy,
  hasLiveOffer,
  partyGuard,
  pendingTradeLine,
  rateLimited,
} from "../../lib/ultima/trades/rules.js";

test("parties: bots, self and strangers are turned away", () => {
  const comp = "c1";
  const managers = [
    { id: "m1", is_bot: false, competition_id: comp },
    { id: "m2", is_bot: false, competition_id: comp },
    { id: "bot", is_bot: true, competition_id: comp },
    { id: "far", is_bot: false, competition_id: "c2" },
  ];
  const guard = (receiverId, proposerId = "m1") =>
    partyGuard({ proposerId, receiverId, competitionId: comp, managers });
  assert.equal(guard("m2").ok, true);
  assert.equal(guard("bot").code, "TRADE_BOT");
  assert.equal(guard("m1").code, "UNAVAILABLE");
  assert.equal(guard("far").code, "UNAVAILABLE");
  assert.equal(guard("nobody").code, "UNAVAILABLE");
  assert.equal(guard(null).code, "UNAVAILABLE");
  assert.equal(guard("m2", "bot").code, "TRADE_BOT");
});

test("rate limit: 20 proposals a day", () => {
  assert.equal(rateLimited(19), false);
  assert.equal(rateLimited(20), true);
  assert.equal(rateLimited(null), false);
});

test("frozen players: another accepted deal blocks, the one being countered or accepted does not", () => {
  const rows = [{ trade_id: "t1", player_id: "p1" }];
  assert.equal(findBusy(rows)?.trade_id, "t1");
  assert.equal(findBusy(rows, "t1"), null);
  assert.equal(findBusy([]), null);
});

test("one live offer between two managers, unless it is the one being countered", () => {
  assert.equal(hasLiveOffer([{ id: "t1" }]), true);
  assert.equal(hasLiveOffer([{ id: "t1" }], "t1"), false);
  assert.equal(hasLiveOffer([]), false);
});

test("accept: blocked when the 24h review would end after the deadline", () => {
  const now = Date.parse("2026-10-07T10:00:00Z");
  const hours = (h) => new Date(now + h * 3_600_000).toISOString();
  assert.equal(acceptTooLate({ deadlineAt: hours(10), now }), true);
  assert.equal(acceptTooLate({ deadlineAt: hours(23.9), now }), true);
  assert.equal(acceptTooLate({ deadlineAt: hours(24), now }), false);
  assert.equal(acceptTooLate({ deadlineAt: hours(30), now }), false);
  assert.equal(acceptTooLate({ deadlineAt: hours(-1), now }), true);
});

test("accept: no deadline, or an unsynced deadline gameweek, never blocks", () => {
  assert.equal(acceptTooLate({ deadlineAt: null }), false);
  assert.equal(acceptTooLate({ deadlineAt: undefined }), false);
  assert.equal(acceptTooLate({ deadlineAt: "not a date" }), false);
});

test("drop confirm line names the other team", () => {
  assert.equal(
    pendingTradeLine(["Doumani Athletic"]),
    "This voids your live offer with Doumani Athletic.",
  );
  assert.equal(
    pendingTradeLine(["Team A", "Team B"]),
    "This voids your live offers with Team A and Team B.",
  );
  assert.equal(
    pendingTradeLine(["A", "B", "C"]),
    "This voids your live offers with A, B and C.",
  );
  assert.equal(pendingTradeLine([]), "");
  assert.equal(pendingTradeLine(undefined), "");
});
