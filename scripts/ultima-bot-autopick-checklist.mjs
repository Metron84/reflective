#!/usr/bin/env node
/**
 * Lightweight checks plus the practice-room checklist for bot autopick.
 *
 * Manual: open a solo practice room (you + 9 bots). Do not pick. Picks 1-10
 * should land without touching Players. Bots show "BOT picking", not a 30s clock.
 */
import { lastPicksNewestFirst, playerSurname } from "../lib/ultima/draft/last-picks.js";

const picks = [
  { pick_number: 1, player: { name: "Lamine Yamal", league: "laliga" } },
  { pick_number: 2, player: { name: "Erling Haaland", league: "pl" } },
  { pick_number: 3, player: { name: "Kylian Mbappe", league: "laliga" } },
  { pick_number: 4, player: { name: "Jamal Musiala", league: "bundesliga" } },
  { pick_number: 5, player: { name: "Cole Palmer", league: "pl" } },
  { pick_number: 6, player: { name: "Khvicha Kvaratskhelia", league: "seriea" } },
];

const latest = lastPicksNewestFirst(picks, 5);
if (latest.length !== 5) throw new Error("Expected 5 chips.");
if (latest[0].pick_number !== 6) throw new Error("Newest pick should lead.");
if (`${latest[0].pick_number} · ${playerSurname(latest[0].player.name)}` !== "6 · Kvaratskhelia") {
  throw new Error("Chip format should be pick · surname.");
}
if (playerSurname("Lamine Yamal") !== "Yamal") throw new Error("Surname should be last token.");

console.log("last-picks helpers ok");
console.log("Practice checklist:");
console.log("1. Start a solo practice room (9 bots). Stay on Players.");
console.log("2. If a bot is first, spinner shows at once. No 30s countdown.");
console.log("3. Consecutive bots resolve in a few seconds, last-picks strip fills.");
console.log("4. Board tab gets a red dot. Opening Board clears it. Tab does not auto-switch.");
console.log("5. Picks 1 to 10 complete with no tap except your own seat.");
