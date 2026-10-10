import assert from "node:assert/strict";
import { test } from "node:test";
import { ULTIMA_DEFAULT_RATING_THRESHOLDS } from "../../lib/ultima/constants.js";
import { nextGameweekState } from "../../lib/ultima/gameweek-state.js";
import { scoreLineup } from "../../lib/ultima/scoring.js";

const thresholds = ULTIMA_DEFAULT_RATING_THRESHOLDS;
const player = (extra = {}) => ({ id: "p", league: "pl", draftRound: 1, undraftedFa: false, ...extra });
const slot = (fixtureStats, extra = {}) => ({ slot: 1, player: player(extra.player), fixtureStats, captain: extra.captain });

test("scoreLineup counts a goal, an assist, rating bands, a captain and a bolt", () => {
  assert.equal(scoreLineup([slot([{ goals: 1, assists: 0, rating: 6 }])], thresholds).baseTotal, 3);
  assert.equal(scoreLineup([slot([{ goals: 0, assists: 1, rating: 6 }])], thresholds).baseTotal, 1);
  assert.equal(scoreLineup([slot([{ goals: 0, assists: 0, rating: 7.0 }])], thresholds).baseTotal, 1);
  assert.equal(scoreLineup([slot([{ goals: 0, assists: 0, rating: 7.4 }])], thresholds).baseTotal, 1);
  assert.equal(scoreLineup([slot([{ goals: 0, assists: 0, rating: 7.5 }])], thresholds).baseTotal, 2);

  const captain = scoreLineup([slot([{ goals: 1, assists: 0, rating: 6 }], { captain: true })], thresholds);
  assert.equal(captain.baseTotal, 3);
  assert.equal(captain.captainTotal, 3);
  assert.equal(captain.boltTotal, 0);
  assert.equal(captain.total, 6);

  const bolt = scoreLineup(
    [slot([{ goals: 2, assists: 0, rating: 6 }], { captain: true, player: { draftRound: 18 } })],
    thresholds,
  );
  assert.equal(bolt.baseTotal, 6);
  assert.equal(bolt.boltTotal, 2);
  assert.equal(bolt.captainTotal, 6);
  assert.equal(bolt.total, 14);
});

test("a gameweek goes final 24 hours after the last full time, not at the window end", () => {
  const gameweek = {
    state: "live",
    window_start: "2026-10-10T20:00:00Z",
    window_end: "2026-10-11T12:00:00Z",
  };
  const fixtures = [{ status: "FT", kickoff_at: "2026-10-10T16:00:00Z" }];
  const fullTime = Date.parse("2026-10-10T18:00:00Z");
  assert.equal(nextGameweekState(gameweek, fixtures, fullTime + 23 * 60 * 60 * 1000), "provisional");
  assert.equal(nextGameweekState(gameweek, fixtures, fullTime + 24 * 60 * 60 * 1000), "final");
  assert.equal(
    nextGameweekState(gameweek, [{ status: "NS", kickoff_at: "2026-10-10T16:00:00Z" }], fullTime + 48 * 60 * 60 * 1000),
    "live",
  );
});
