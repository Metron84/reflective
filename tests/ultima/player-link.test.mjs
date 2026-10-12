import assert from "node:assert/strict";
import test from "node:test";
import {
  indexPlayersBySportmonksId,
  playerIdForSportmonks,
  sportmonksIdFromProviderId,
} from "../../lib/ultima/player-link.js";

test("the third provider_id field is the Sportmonks player id", () => {
  assert.equal(sportmonksIdFromProviderId("sm-pl-1289"), 1289);
  assert.equal(sportmonksIdFromProviderId("sm-player-42"), 42);
  assert.equal(sportmonksIdFromProviderId("sm-pl"), null);
  assert.equal(sportmonksIdFromProviderId("not-an-id"), null);
});

test("a stat row links when provider_id matches and seed_metrics does not", () => {
  const index = indexPlayersBySportmonksId([
    { id: "p1", provider_id: "sm-pl-1289" },
    { id: "p2", provider_id: "sm-laliga-7", seed_metrics: { sportmonks_player_id: 8 } },
  ]);
  assert.equal(playerIdForSportmonks(index, 1289), "p1");
  assert.equal(playerIdForSportmonks(index, "1289"), "p1");
  assert.equal(playerIdForSportmonks(index, 8), "p2");
  assert.equal(playerIdForSportmonks(index, 7), "p2");
  assert.equal(playerIdForSportmonks(index, 999), null);
});

test("two players with the same Sportmonks id are not linked", () => {
  const index = indexPlayersBySportmonksId([
    { id: "a", provider_id: "sm-pl-5" },
    { id: "b", provider_id: "sm-laliga-5" },
  ]);
  assert.equal(playerIdForSportmonks(index, 5), null);
});
