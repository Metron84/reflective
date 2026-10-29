/**
 * Crest database and engine checks. Run with `npm run check:crest`.
 * Exits non-zero if a club breaks the scoring rules or the recovery
 * test misses its targets.
 */
import { BINARY_CARD_IDS, CARDS, DECKS, TOTAL, allowsBoth } from "../lib/crest/cards.js";
import { parseBallot } from "../lib/crest/result-store.js";
import { CLUBS, CREST_GROUPS } from "../lib/crest/clubs.js";
import { CREST_COMPETITIONS } from "../lib/crest/competitions.js";
import {
  blend,
  rankClubs,
  nextCard,
  arrivalSummary,
  colourMap,
  leagueMap,
  playPool,
} from "../lib/crest/match.js";
import { buildReport, meetPhrase, REPORT_PHRASES, roomPercent } from "../lib/crest/report.js";
import { categoryOf } from "../lib/crest/pools.js";
import { buildOutcome } from "../lib/crest/outcome.js";
import { STAKES, isStake, liveStake, stakeLine } from "../lib/crest/stakes.js";

const SCALE = new Set([-1, -0.6, -0.3, 0, 0.3, 0.6, 1]);
const dash = /\u2014|\u2013/;
let failures = 0;

console.log(`clubs: ${CLUBS.length}`);
const GROUP_COUNTS = {
  England: 64,
  Germany: 36,
  Italy: 25,
  Spain: 25,
  France: 21,
  "Rest of the World": 12,
};
if (CREST_GROUPS.join(",") !== "England,Germany,Italy,Spain,France,Rest of the World") {
  failures++;
  console.log(`FAIL groups: order is ${CREST_GROUPS.join(", ")}`);
}
for (const g of CREST_GROUPS) {
  const n = CLUBS.filter((c) => c.group === g).length;
  if (n !== GROUP_COUNTS[g]) {
    failures++;
    console.log(`FAIL groups: ${g} has ${n}, expected ${GROUP_COUNTS[g]}`);
  }
}
if (CLUBS.some((c) => c.country === "Italy" && c.group !== "Italy")) {
  failures++;
  console.log("FAIL groups: an Italian club is not in Italy");
}
for (const club of CLUBS) {
  const problems = [];
  if (club.self.length !== 12 || club.others.length !== 12) problems.push("length");
  if ([...club.self, ...club.others].some((v) => !SCALE.has(v))) problems.push("scale");
  const ones = (v) => v.filter((x) => Math.abs(x) === 1).length;
  if (ones(club.self) > 5 || ones(club.others) > 5) problems.push("too many poles");
  const diff = club.self.filter((v, i) => v !== club.others[i]).length;
  if (diff < 2 && !club.flags.includes("narrow-gap")) problems.push("self equals others, unflagged");
  if (club.competition && !CREST_COMPETITIONS.includes(club.competition)) {
    problems.push(`bad competition ${club.competition}`);
  }
  if (problems.length) {
    failures++;
    console.log(`FAIL ${club.slug}: ${problems.join(", ")}`);
  }
}

const competitionCounts = {};
for (const club of CLUBS) {
  const key = club.competition || "null";
  competitionCounts[key] = (competitionCounts[key] || 0) + 1;
}
console.log("competitions", Object.entries(competitionCounts).map(([k, v]) => `${k}:${v}`).join(" | "));
if (competitionCounts["Premier League"] !== 20) {
  failures++;
  console.log(`FAIL competitions: Premier League has ${competitionCounts["Premier League"]}, expected 20`);
}
if (competitionCounts.Championship !== 20) {
  failures++;
  console.log(`FAIL competitions: Championship has ${competitionCounts.Championship}, expected 20`);
}

if (TOTAL !== 10 || CARDS.length !== 50) {
  failures++;
  console.log(`FAIL deck: ${CARDS.length} cards, TOTAL ${TOTAL}, expected 50 cards and a run of 10`);
}
for (const [id, deck] of Object.entries(DECKS)) {
  if (deck.length !== 10) {
    failures++;
    console.log(`FAIL deck: ${id} has ${deck.length}`);
  }
}
if (CARDS.some((c) => !c.context)) {
  failures++;
  console.log("FAIL deck: every card needs a context line");
}
if (BINARY_CARD_IDS.some((id) => allowsBoth(CARDS.find((c) => c.id === id)))) {
  failures++;
  console.log("FAIL deck: a decision card still allows Both");
}

console.log("\nstakes");
const STAKE_IDS = ["belonging", "love", "winning", "belonging_love", "love_winning"];
if (STAKES.map((row) => row.id).join(",") !== STAKE_IDS.join(",")) {
  failures++;
  console.log(`FAIL stakes: ids are ${STAKES.map((row) => row.id).join(", ")}`);
}
if (!isStake("love") || isStake("fortune") || liveStake("fortune") !== null) {
  failures++;
  console.log("FAIL stakes: live stake gate");
}
if (stakeLine("love") !== "You wanted love.") {
  failures++;
  console.log(`FAIL stakes: love line is ${stakeLine("love")}`);
}
if (categoryOf("slavia-prague") !== "belonging") {
  failures++;
  console.log(`FAIL pools: Slavia is ${categoryOf("slavia-prague")}`);
}

const belongingAnswers = [
  { cardId: 9, value: -1 },
  { cardId: 8, value: -1 },
  { cardId: 7, value: -1 },
];
const belongingRank = rankClubs(belongingAnswers, undefined, { stake: "belonging" });
const millwall = belongingRank.find((row) => row.club.slug === "millwall");
const brighton = belongingRank.find((row) => row.club.slug === "brighton");
if (!millwall || Math.round(millwall.score * 100) !== 60 || !brighton || Math.round(brighton.score * 100) !== 25) {
  failures++;
  console.log(`FAIL suit: Millwall ${millwall && Math.round(millwall.score * 100)} Brighton ${brighton && Math.round(brighton.score * 100)}`);
}

const loveAnswers = DECKS.love.map((card) => ({ cardId: card.id, value: card.leftValue }));
const outcome = buildOutcome(loveAnswers, { stake: "love" });
const countryNames = outcome.countries.map((row) => row.country);
if (countryNames.slice(0, 5).join(",") !== "England,Spain,Italy,Germany,France" || countryNames.at(-1) !== "Rest of the World") {
  failures++;
  console.log(`FAIL leagues: ${countryNames.join(" | ")}`);
}
const rest = outcome.countries.at(-1);
if (!rest || rest.leagues.length < 2) {
  failures++;
  console.log("FAIL leagues: Rest of the World is missing its leagues");
}

if (failures) {
  console.log(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nall checks passed");
