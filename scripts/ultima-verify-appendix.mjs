/**
 * Appendix A worked example QA (spec section 988–1013).
 * Run: node scripts/ultima-verify-appendix.mjs
 */
import { scoreLineup } from "../lib/ultima/scoring.js";

const APPENDIX_LINEUP = [
  {
    slot: 1,
    player: { id: "pl-a", league: "pl", draftRound: 2 },
    fixtureStats: [{ goals: 1, assists: 1, rating: 8.1 }],
  },
  {
    slot: 2,
    player: { id: "pl-b", league: "pl", draftRound: 7 },
    fixtureStats: [{ goals: 0, assists: 0, rating: 6.8 }],
  },
  {
    slot: 3,
    player: { id: "pl-c", league: "pl", draftRound: 11 },
    fixtureStats: [{ goals: 1, assists: 0, rating: 7.6 }],
  },
  {
    slot: 4,
    player: { id: "ll-d", league: "laliga", draftRound: 1 },
    fixtureStats: [{ goals: 0, assists: 2, rating: 7.9 }],
  },
  {
    slot: 5,
    player: { id: "ll-e", league: "laliga", draftRound: 9 },
    fixtureStats: [{ goals: 2, assists: 0, rating: 8.3 }],
  },
  {
    slot: 6,
    player: { id: "ll-f", league: "laliga", draftRound: 14 },
    fixtureStats: [{ goals: 0, assists: 1, rating: 7.2 }],
  },
  {
    slot: 7,
    player: { id: "sa-g", league: "seriea", draftRound: 5 },
    fixtureStats: [{ goals: 1, assists: 0, rating: 7.4 }],
  },
  {
    slot: 8,
    player: { id: "sa-h", league: "seriea", draftRound: 18 },
    fixtureStats: [{ goals: 1, assists: 1, rating: 7.7 }],
  },
  {
    slot: 9,
    player: { id: "sa-i", league: "seriea", draftRound: 20 },
    fixtureStats: [{ goals: 0, assists: 0, rating: 7.1 }],
  },
  {
    slot: 10,
    player: { id: "pl-j", league: "pl", draftRound: 13 },
    fixtureStats: [{ goals: 0, assists: 1, rating: 6.9 }],
  },
  {
    slot: 11,
    player: { id: "ll-k", league: "laliga", draftRound: 6 },
    fixtureStats: [
      { goals: 1, assists: 0, rating: 7.5 },
      { goals: 0, assists: 0, rating: 6.6 },
    ],
  },
];

const EXPECTED = { baseTotal: 42, boltTotal: 2, total: 44 };

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

if (ok) {
  console.log("Appendix A scoring: PASS");
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

process.exit(1);
