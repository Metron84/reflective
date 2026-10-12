import assert from "node:assert/strict";
import test from "node:test";
import { firstXvByDraftOrder } from "../../lib/ultima/lineup/auto-start.js";

function player(id, league, draft_round, extra = {}) {
  return { id, league, draft_round, ...extra };
}

test("an unset lineup auto-starts the first valid XV in draft order", () => {
  const roster = [
    player("late", "pl", 20),
    player("pl-1", "pl", 1),
    player("hurt", "pl", 2, { inactive_flag: true }),
    player("pl-2", "pl", 4),
    player("pl-3", "pl", 6),
    player("lla-1", "laliga", 3),
    player("lla-2", "laliga", 5),
    player("lla-3", "laliga", 7),
    player("sa-1", "seriea", 8),
    player("sa-2", "seriea", 9),
    player("sa-3", "seriea", 10),
    player("bu-1", "bundesliga", 11),
    player("bu-2", "bundesliga", 12),
    player("bu-3", "bundesliga", 13),
    player("l1-1", "ligue1", 14),
    player("l1-2", "ligue1", 15),
    player("l1-3", "ligue1", 16),
    player("gone", "pl", 17, { active: false }),
  ];

  const xv = firstXvByDraftOrder(roster);
  const pl = xv.filter((row) => row.slot_group === "pl");
  assert.deepEqual(pl.map((row) => row.player_id), ["pl-1", "pl-2", "pl-3"]);
  assert.equal(pl.every((row) => row.auto_started), true);
  assert.equal(xv.filter((row) => row.player_id).length, 15);
  assert.equal(xv.every((row) => !row.player_id || row.auto_started), true);
  assert.equal(xv.some((row) => row.player_id === "late"), false);
  assert.equal(xv.some((row) => row.player_id === "hurt"), false);
});
