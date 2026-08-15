/**
 * Appendix A worked example QA (v5: 15 slots, five leagues).
 * Run: node scripts/ultima-verify-appendix.mjs
 */
import { scoreLineup } from "../lib/ultima/scoring.js";

const APPENDIX_LINEUP = [
  { slot: 1, player: { id: "pl-a", league: "pl", draftRound: 2 }, fixtureStats: [{ goals: 1, assists: 1, rating: 8.1 }] },
  { slot: 2, player: { id: "pl-b", league: "pl", draftRound: 7 }, fixtureStats: [{ goals: 0, assists: 0, rating: 6.8 }] },
  { slot: 3, player: { id: "pl-c", league: "pl", draftRound: 11 }, fixtureStats: [{ goals: 1, assists: 0, rating: 7.6 }] },
  { slot: 4, player: { id: "ll-d", league: "laliga", draftRound: 1 }, fixtureStats: [{ goals: 0, assists: 2, rating: 7.9 }] },
  { slot: 5, player: { id: "ll-e", league: "laliga", draftRound: 9 }, fixtureStats: [{ goals: 2, assists: 0, rating: 8.3 }] },
  {
    slot: 6,
    player: { id: "ll-k", league: "laliga", draftRound: 6 },
    fixtureStats: [
      { goals: 1, assists: 0, rating: 7.5 },
      { goals: 0, assists: 0, rating: 6.6 },
    ],
  },
  { slot: 7, player: { id: "sa-g", league: "seriea", draftRound: 5 }, fixtureStats: [{ goals: 1, assists: 0, rating: 7.4 }] },
  { slot: 8, player: { id: "sa-h", league: "seriea", draftRound: 18 }, fixtureStats: [{ goals: 1, assists: 1, rating: 7.7 }] },
  { slot: 9, player: { id: "sa-i", league: "seriea", draftRound: 20 }, fixtureStats: [{ goals: 0, assists: 0, rating: 7.1 }] },
  { slot: 10, player: { id: "bl-a", league: "bundesliga", draftRound: 4 }, fixtureStats: [{ goals: 0, assists: 0, rating: 6.5 }] },
  { slot: 11, player: { id: "bl-b", league: "bundesliga", draftRound: 12 }, fixtureStats: [{ goals: 0, assists: 0, rating: 6.4 }] },
  { slot: 12, player: { id: "bl-c", league: "bundesliga", draftRound: 22 }, fixtureStats: [{ goals: 0, assists: 0, rating: 6.3 }] },
  { slot: 13, player: { id: "l1-a", league: "ligue1", draftRound: 3 }, fixtureStats: [{ goals: 0, assists: 0, rating: 6.5 }] },
  { slot: 14, player: { id: "l1-b", league: "ligue1", draftRound: 15 }, fixtureStats: [{ goals: 0, assists: 0, rating: 6.4 }] },
  { slot: 15, player: { id: "l1-c", league: "ligue1", draftRound: 25 }, fixtureStats: [{ goals: 0, assists: 0, rating: 6.3 }] },
];

/** v5: three per league; BL/L1 score zero in this sample week. */
const EXPECTED = { baseTotal: 39, boltTotal: 2, total: 41 };

const result = scoreLineup(APPENDIX_LINEUP);

let ok = true;
for (const [key, expected] of Object.entries(EXPECTED)) {
  if (result[key] !== expected) {
    console.error(`FAIL ${key}: expected ${expected}, got ${result[key]}`);
    ok = false;
  }
}

const slotH = result.slots.find((s) => s.slot === 8);
if (!slotH?.boltAwarded) {
  console.error("FAIL: Player H should receive Bolt bonus");
  ok = false;
}

const slotI = result.slots.find((s) => s.slot === 9);
if (slotI?.boltAwarded) {
  console.error("FAIL: Player I should not receive Bolt bonus");
  ok = false;
}

if (result.slots.length !== 15) {
  console.error(`FAIL: expected 15 scored slots, got ${result.slots.length}`);
  ok = false;
}

if (ok) {
  console.log("Appendix A scoring (v5): PASS");
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

process.exit(1);
