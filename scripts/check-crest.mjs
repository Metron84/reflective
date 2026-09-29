/**
 * Crest database and engine checks. Run with `npm run check:crest`.
 * Exits non-zero if a club breaks the scoring rules or the recovery
 * test misses its targets.
 */
import { BINARY_CARD_IDS, CARDS, TOTAL, allowsBoth } from "../lib/crest/cards.js";
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
} from "../lib/crest/engine.js";
import { buildReport, meetPhrase, REPORT_PHRASES, roomPercent } from "../lib/crest/report.js";
import { STAKES, isStake, lifeOrder, stakeCoeff, stakeLine } from "../lib/crest/stakes.js";

const SCALE = new Set([-1, -0.6, -0.3, 0, 0.3, 0.6, 1]);
const dash = /\u2014|\u2013/;
let failures = 0;

console.log(`clubs: ${CLUBS.length}`);
const GROUP_COUNTS = {
  England: 64,
  Germany: 36,
  Italy: 26,
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

if (CARDS.length !== TOTAL || TOTAL !== 18) {
  failures++;
  console.log(`FAIL deck: ${CARDS.length} cards, TOTAL ${TOTAL}, expected 18`);
}
const partCounts = { 1: 0, 2: 0, 3: 0 };
const facetSeen = new Set();
for (const c of CARDS) {
  partCounts[c.part] += 1;
  facetSeen.add(c.facet);
}
if (partCounts[1] !== 5 || partCounts[2] !== 6 || partCounts[3] !== 7) {
  failures++;
  console.log(`FAIL deck: parts ${partCounts[1]}/${partCounts[2]}/${partCounts[3]}, expected 5/6/7`);
}
if (facetSeen.size !== 12) {
  failures++;
  console.log(`FAIL deck: ${facetSeen.size} facets covered, expected 12`);
}
if (CARDS.some((c) => !c.context)) {
  failures++;
  console.log("FAIL deck: every card needs a context line");
}
if (CARDS.some((c) => c.context && /\u2014|\u2013/.test(c.context))) {
  failures++;
  console.log("FAIL deck: em-dash in card context");
}
if (BINARY_CARD_IDS.some((id) => allowsBoth(CARDS.find((c) => c.id === id)))) {
  failures++;
  console.log("FAIL deck: a decision card still allows Both");
}

const westHam = CLUBS.find((c) => c.slug === "west-ham-united");
if (
  !westHam ||
  westHam.self[9] !== -0.3 ||
  westHam.others[9] !== -0.3 ||
  westHam.others[7] !== -0.3 ||
  westHam.othersMask[7] !== true
) {
  failures++;
  console.log("FAIL west-ham: terrace stamp missing (old ground / sack him)");
}

const sampleBallot = {
  answers: CARDS.map((card) => ({
    cardId: card.id,
    value: allowsBoth(card) ? 0 : 1,
  })),
  stake: "love",
  scope: "England",
};
if (parseBallot(sampleBallot).error) {
  failures++;
  console.log(`FAIL save: valid ballot rejected (${parseBallot(sampleBallot).error})`);
}
const bothOnBinary = {
  answers: CARDS.map((card) => ({ cardId: card.id, value: 0 })),
  stake: "love",
};
if (!parseBallot(bothOnBinary).error) {
  failures++;
  console.log("FAIL save: Both on a decision card was accepted");
}

const LIFE_CARDS = CARDS.filter((c) => c.part === 1);
function lifeAnswersFromBits(bits) {
  return LIFE_CARDS.map((card, i) => ({
    cardId: card.id,
    value: /** @type {1|-1} */ ((bits >> i) & 1 ? 1 : -1),
  }));
}
for (let bits = 0; bits < 32; bits++) {
  const pool = playPool(lifeAnswersFromBits(bits));
  if (!pool.length) {
    failures++;
    console.log(`FAIL funnel: Life pattern ${bits.toString(2).padStart(5, "0")} emptied the pool`);
    break;
  }
}
let lifeMiss = 0;
for (const club of CLUBS) {
  const answers = LIFE_CARDS.map((card) => {
    const axis = blend(club, card.facet);
    const value = Math.abs(axis) < 0.2 ? 1 : Math.sign(axis);
    return { cardId: card.id, value: /** @type {1|-1} */ (value) };
  });
  if (!playPool(answers).some((row) => row.slug === club.slug)) lifeMiss++;
}
if (lifeMiss) {
  failures++;
  console.log(`FAIL funnel: ${lifeMiss} clubs miss their own Life pool`);
}
console.log(`funnel: 32 Life patterns all non-empty, own-club Life misses ${lifeMiss}`);
const bothLife = LIFE_CARDS.map((card) => ({ cardId: card.id, value: 0 }));
if (playPool(bothLife).length !== CLUBS.length) {
  failures++;
  console.log(`FAIL both: all-Both Life pool is ${playPool(bothLife).length}, expected ${CLUBS.length}`);
}
const later = CARDS.filter((c) => c.part >= 2).slice(0, 6).map((c) => ({
  cardId: c.id,
  value: c.id === 18 ? 0 : 1,
}));
const after = playPool([...bothLife, ...later]);
if (after.length < 3) {
  failures++;
  console.log(`FAIL both: meaning Both emptied the play pool (${after.length})`);
}
console.log(`both: all-Both Life keeps ${playPool(bothLife).length} clubs`);

console.log("\nstakes");
const STAKE_IDS = ["belonging", "winning", "belonging_winning", "fame_fortune", "fortune", "love"];
if (STAKES.map((row) => row.id).join(",") !== STAKE_IDS.join(",")) {
  failures++;
  console.log(`FAIL stakes: ids are ${STAKES.map((row) => row.id).join(", ")}`);
}
if (isStake("love") !== true || isStake("fame") || isStake(null)) {
  failures++;
  console.log("FAIL stakes: isStake gate");
}
if (stakeCoeff(null, 7) !== 1 || stakeCoeff("love", 7) !== 2 || stakeCoeff("fortune", 10) !== 2) {
  failures++;
  console.log("FAIL stakes: coefficients");
}
if (stakeLine("love") !== "You wanted love.") {
  failures++;
  console.log(`FAIL stakes: love line is ${stakeLine("love")}`);
}
const stakeCopy = STAKES.map((row) => `${row.label} ${row.line} ${stakeLine(row.id)}`).join(" ");
if (dash.test(stakeCopy)) {
  failures++;
  console.log("FAIL stakes: em-dash in chip copy");
}
for (const stake of STAKES) {
  if (stake.coeff.length !== 12) {
    failures++;
    console.log(`FAIL stakes: ${stake.id} coeff length ${stake.coeff.length}`);
  }
  if (stake.coeff.some((value) => value !== 1 && value !== 1.4 && value !== 2)) {
    failures++;
    console.log(`FAIL stakes: ${stake.id} has a coeff outside 1 / 1.4 / 2`);
  }
  if (stake.coeff.some((value) => value === 0)) {
    failures++;
    console.log(`FAIL stakes: ${stake.id} zeroed a room`);
  }
  if ([...stake.life].sort((a, b) => a - b).join(",") !== "1,2,3,4,5") {
    failures++;
    console.log(`FAIL stakes: ${stake.id} Life order is not the five Life cards`);
  }
  const played = [];
  for (const id of lifeOrder(stake.id)) {
    const next = nextCard(played, undefined, { stake: stake.id });
    if (!next || next.card.id !== id) {
      failures++;
      console.log(`FAIL stakes: ${stake.id} expected Life ${id}, got ${next?.card.id}`);
      break;
    }
    played.push({ cardId: id, value: 1 });
  }
}
{
  const played = [];
  for (const id of [1, 2, 3, 4, 5]) {
    const next = nextCard(played);
    if (!next || next.card.id !== id) {
      failures++;
      console.log(`FAIL stakes: default Life expected ${id}, got ${next?.card.id}`);
      break;
    }
    played.push({ cardId: id, value: 1 });
  }
}
if (nextCard([], undefined, { stake: "belonging" })?.card.id !== 3) {
  failures++;
  console.log("FAIL stakes: belonging should open on People");
}
if (nextCard([], undefined, { stake: "love" })?.card.id !== 1) {
  failures++;
  console.log("FAIL stakes: love should open on Fun/Work");
}
{
  const loveLife = lifeOrder("love").map((id) => ({ cardId: id, value: 0 }));
  const next = nextCard(loveLife, undefined, { stake: "love" });
  const hot = next ? stakeCoeff("love", next.card.facet) : 0;
  console.log(`  love first likes: card ${next?.card.id} coeff ${hot}`);
  if (!next || next.card.part !== 2) {
    failures++;
    console.log("FAIL stakes: love after Life did not open Likes");
  }
}
for (const stake of STAKES) {
  const played = [];
  for (let i = 0; i < TOTAL; i++) {
    if (!playPool(played, undefined, { stake: stake.id }).length) {
      failures++;
      console.log(`FAIL stakes: ${stake.id} empty pool before card ${i + 1}`);
      break;
    }
    const next = nextCard(played, undefined, { stake: stake.id });
    if (!next) {
      failures++;
      console.log(`FAIL stakes: ${stake.id} nextCard null at ${i}`);
      break;
    }
    const value = i % 3 === 0 ? 0 : i % 2 ? 1 : -1;
    played.push({ cardId: next.card.id, value });
  }
  if (played.length === TOTAL) {
    const pool = playPool(played, undefined, { stake: stake.id });
    if (pool.length < 3) {
      failures++;
      console.log(`FAIL stakes: ${stake.id} final pool ${pool.length}`);
    }
    const row = arrivalSummary(played, undefined, { stake: stake.id });
    if (roomPercent(row.probability) !== Math.round(Math.max(0, Math.min(1, row.probability)) * 100)) {
      failures++;
      console.log(`FAIL stakes: ${stake.id} hero percent is not last-room share`);
    }
  }
}

const toAnswers = (hand) =>
  CARDS.filter((c) => hand[c.id]).map((c) => ({
    cardId: c.id,
    value: hand[c.id] === "L" ? c.leftValue : -c.leftValue,
  }));
const mk = (fn) => Object.fromEntries(CARDS.map((c) => [c.id, fn(c)]));
const want = (t) => mk((c) => (Math.sign(c.leftValue) === Math.sign(t[c.facet] ?? 0) ? "L" : "R"));

const hands = {
  romanticLocal: want([1, 1, -1, -1, -1, -1, -1, 1, -1, -1, -1, -1]),
  gloryGlobal: want([-1, 1, 1, 1, -1, 1, 1, -1, 1, 1, 1, 1]),
  calmPlannerLocal: want([1, -1, -1, -1, 1, -1, -1, -1, -1, -1, -1, -1]),
  dataClub: want([-1, -1, 1, 1, 1, -1, 1, -1, 1, 1, 1, 1]),
  beautifulGloryGlobal: want([-1, 1, 1, 1, -1, 1, -1, 1, 1, 1, -1, 1]),
};
console.log("\ntest hands (top 3)");
for (const [name, hand] of Object.entries(hands)) {
  const top = rankClubs(toAnswers(hand)).slice(0, 3);
  console.log(
    `  ${name.padEnd(22)} ${top.map((r) => `${r.club.slug} ${r.score.toFixed(3)}`).join(" | ")}`,
  );
}

const N = CLUBS.length;
const F = 12;
const M = CLUBS.map((c) => Array.from({ length: F }, (_, i) => blend(c, i)));
let seed = 11;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const gauss = () => {
  let u = 0;
  let v = 0;
  while (!u) u = rnd();
  while (!v) v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const noisyHand = (vec) =>
  CARDS.map((c) => ({
    cardId: c.id,
    value: /** @type {1|-1} */ (Math.sign(vec[c.facet] + 0.45 * gauss()) || 1),
  }));

const HANDS = 30;
let hit1 = 0;
let hit5 = 0;
const ranks = [];
const wins = {};
const colourHits = { n: 0, top3: 0 };

for (let c = 0; c < N; c++) {
  for (let h = 0; h < HANDS; h++) {
    const answers = noisyHand(M[c]);
    const ranked = rankClubs(answers);
    const rank = ranked.findIndex((r) => r.club.slug === CLUBS[c].slug) + 1;
    ranks.push(rank);
    if (rank === 1) hit1++;
    if (rank <= 5) hit5++;
    wins[ranked[0].club.slug] = (wins[ranked[0].club.slug] || 0) + 1;

    const families = CLUBS[c].colourFamilies || [];
    if (families.length) {
      const row = ranked.filter((r) => r.club.colourFamilies && r.club.colourFamilies.includes(families[0]));
      colourHits.n++;
      if (row.slice(0, 5).some((r) => r.club.slug === CLUBS[c].slug)) colourHits.top3++;
    }
  }
}

ranks.sort((a, b) => a - b);
const total = N * HANDS;
const median = ranks[Math.floor(ranks.length / 2)];
const neverReturned = N - Object.keys(wins).length;
const thieves = Object.entries(wins).sort((a, b) => b[1] - a[1]);
const thiefShare = thieves[0][1] / total;
const hit5Share = hit5 / total;
const colourShare = colourHits.n ? colourHits.top3 / colourHits.n : 0;

console.log("\nrecovery (own-club vector + noise, 30 hands each)");
console.log(
  `  hit@1 ${(100 * hit1 / total).toFixed(0)}%  hit@5 ${(100 * hit5Share).toFixed(0)}%  median rank ${median}`,
);
console.log(`  clubs never returned: ${neverReturned}`);
console.log(
  `  biggest thief: ${thieves[0][0]} ${(100 * thiefShare).toFixed(1)}%`,
);
console.log(
  `  own-colour row top 3: ${(100 * colourShare).toFixed(0)}% (${colourHits.n} coloured hands)`,
);

if (hit5Share < 0.45) {
  failures++;
  console.log("FAIL recovery: hit@5 under 45%");
}
if (neverReturned > 0) {
  failures++;
  console.log("FAIL recovery: clubs never returned");
}
if (thiefShare > 0.02) {
  failures++;
  console.log("FAIL recovery: a club takes more than 2% of hands");
}
if (colourHits.n && colourShare < 0.6) {
  failures++;
  console.log("FAIL colour map: own-colour row top 3 under 60%");
}

const leagueProbe = leagueMap(toAnswers(hands.romanticLocal));
if (!leagueProbe.length) {
  failures++;
  console.log("FAIL league map: no rows");
}
const englandHand = toAnswers(hands.romanticLocal);
const englandProbe = leagueMap(englandHand, undefined, { group: "England" });
if (englandProbe.some((row) => row.competition === "Serie A" || row.competition === "LaLiga")) {
  failures++;
  console.log("FAIL league map: England scope leaked another country");
}
const englandRoom = playPool(englandHand, undefined, { group: "England" });
if (englandRoom.some((club) => club.competition === "Premier League") && !englandProbe.some((row) => row.competition === "Premier League")) {
  failures++;
  console.log("FAIL league map: England last room has Premier League, list does not");
}

const answers = [];
for (let i = 0; i < TOTAL; i++) {
  if (!playPool(answers).length) {
    failures++;
    console.log(`FAIL funnel: play pool empty before card ${i + 1}`);
    break;
  }
  const next = nextCard(answers);
  if (!next) {
    failures++;
    console.log("FAIL flow: nextCard returned null early");
    break;
  }
  answers.push({ cardId: next.card.id, value: rnd() < 0.5 ? 1 : -1 });
}
if (answers.length === TOTAL) {
  const finalPool = playPool(answers);
  if (finalPool.length < 3) {
    failures++;
    console.log(`FAIL funnel: final play pool ${finalPool.length}, expected at least 3`);
  }
  if (nextCard(answers)) {
    failures++;
    console.log("FAIL flow: nextCard still open after the deck");
  }
}
const arrival = arrivalSummary(answers);
console.log(
  `\nflow: ${TOTAL} cards -> ${arrival.club.name} (${arrival.score.toFixed(3)}, p=${arrival.probability.toFixed(3)}, room=${roomPercent(arrival.probability)}%, ${arrival.confident ? "confident" : "between"})`,
);
const flowLeagues = leagueMap(answers);
const flowColours = colourMap(answers);
const heroLeague = flowLeagues.find((row) => row.clubs.some((entry) => entry.club.slug === arrival.club.slug));
if (!heroLeague || heroLeague.clubs[0].club.slug !== arrival.club.slug) {
  failures++;
  console.log(`FAIL last-room: hero is not first in its league (${heroLeague?.clubs[0]?.club.slug || "missing"})`);
}
if (heroLeague && roomPercent(heroLeague.clubs[0].probability) !== roomPercent(arrival.probability)) {
  failures++;
  console.log("FAIL last-room: league percent is not the hero share");
}
const heroFamily = (arrival.club.colourFamilies || [])[0];
const heroColour = flowColours.find((row) => row.family === heroFamily);
if (heroFamily && heroColour && heroColour.clubs[0].club.slug !== arrival.club.slug) {
  failures++;
  console.log(`FAIL last-room: hero is not first in ${heroFamily}`);
}

const reportHands = {
  romanticLocal: toAnswers(hands.romanticLocal),
  gloryGlobal: toAnswers(hands.gloryGlobal),
};
console.log("\nreport");
for (const [name, hand] of Object.entries(reportHands)) {
  const blendView = buildReport({ answers: hand, group: null, colour: null }, "blend");
  const selfView = buildReport({ answers: hand, group: null, colour: null }, "self");
  const othersView = buildReport({ answers: hand, group: null, colour: null }, "others");
  const flags = arrivalSummary(hand);
  const sharedKeys = blendView.shared.map((f) => f.id).join(",");
  const facetKeys = [
    "winning-vs-enduring",
    "emotional-climate",
    "openness",
    "what-gives-meaning",
    "style",
    "risk",
    "talent",
    "philosophy",
    "reach",
    "time",
    "power",
    "purpose",
  ];
  const expectedShared = flags.greenFlags.map((flag) => REPORT_PHRASES[facetKeys.indexOf(flag.facet.key)].id);
  console.log(
    `  ${name.padEnd(22)} ${blendView.club.name} ${blendView.matchPct}% shared=${sharedKeys}`,
  );
  if (selfView.club.id !== blendView.club.id || othersView.club.id !== blendView.club.id) {
    failures++;
    console.log(`FAIL report ${name}: view re-ranked the club`);
  }
  if (expectedShared.join(",") !== sharedKeys) {
    failures++;
    console.log(`FAIL report ${name}: shared ${sharedKeys} != engine ${expectedShared.join(",")}`);
  }
  const copy = [
    blendView.opener,
    blendView.verdict,
    blendView.clusterLine,
    blendView.stakeLine,
    ...blendView.closeBehind.map((c) => c.reason),
  ].join(" ");
  if (dash.test(copy)) {
    failures++;
    console.log(`FAIL report ${name}: em-dash in copy`);
  }
  if (facetKeys.filter((key) => key.includes("-")).some((key) => copy.includes(key))) {
    failures++;
    console.log(`FAIL report ${name}: raw facet key in copy`);
  }
  const england = buildReport({ answers: hand, group: "England", colour: null }, "blend");
  const englandComps = england.leagues.map((row) => row.group);
  if (englandComps.includes("Serie A") || englandComps.includes("LaLiga")) {
    failures++;
    console.log(`FAIL report ${name}: England scope leaked another country`);
  }
  const englandRoomClubs = playPool(hand, undefined, { group: "England" });
  if (englandRoomClubs.some((club) => club.competition === "Premier League") && !englandComps.includes("Premier League")) {
    failures++;
    console.log(`FAIL report ${name}: England last room has Premier League, list does not`);
  }
  if (englandRoomClubs.some((club) => club.competition === "Championship") && !englandComps.includes("Championship")) {
    failures++;
    console.log(`FAIL report ${name}: England last room has Championship, list does not`);
  }
  const seenComp = new Set();
  for (const row of blendView.leagues) {
    if (seenComp.has(row.group)) {
      failures++;
      console.log(`FAIL report ${name}: duplicate competition ${row.group}`);
    }
    seenComp.add(row.group);
  }
  if (!blendView.leagues.length) {
    failures++;
    console.log(`FAIL report ${name}: no league rows`);
  }
}

const loveReport = buildReport(
  { answers: reportHands.romanticLocal, group: null, colour: null, stake: "love" },
  "blend",
);
if (!loveReport || loveReport.stakeLine !== "You wanted love.") {
  failures++;
  console.log(`FAIL report: love stake line is ${loveReport?.stakeLine}`);
}

const meetBalanced = meetPhrase(REPORT_PHRASES[4], 0, 0.3);
if (meetBalanced !== "how the game should look" && meetBalanced !== "results") {
  failures++;
  console.log(`FAIL meetPhrase balanced user: ${meetBalanced}`);
}

if (failures) {
  console.log(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nall checks passed");
