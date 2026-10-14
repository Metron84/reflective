import test from "node:test";
import assert from "node:assert/strict";
import {
  LEAGUE_MATCHERS,
  clubKeys,
  dominantColours,
  matchLeagueClubs,
  parseOverride,
  pickTeam,
  resolveLeagues,
  searchQueries,
  sportmonksColours,
  teamKey,
  unmatchedCategory,
} from "@/lib/crest/media-match.js";
import { CLUBS } from "@/lib/crest/clubs.js";
import { CREST_COMPETITIONS } from "@/lib/crest/competitions.js";
import { AA_GRAPHIC, AA_TEXT, contrast, leaguePalette } from "@/lib/crest/colour.js";
import { clubMedia } from "@/lib/crest/club-media.js";

const arsenal = { slug: "arsenal", name: "Arsenal", country: "England", founded: 1886 };
const team = (extra) => ({ id: 1, name: "Arsenal", founded: 1886, country: { name: "England" }, image_path: "https://cdn/x.png", ...extra });

test("pickTeam takes the clear winner", () => {
  const { team: t } = pickTeam(arsenal, [team(), team({ id: 2, name: "Arsenal Women", founded: 1987 })]);
  assert.equal(t.id, 1);
});

test("pickTeam never guesses: weak score, tie, national team, no image", () => {
  assert.equal(pickTeam(arsenal, []).team, null);
  assert.match(pickTeam(arsenal, [team({ name: "Chelsea", founded: 1905 })]).reason, /below 70/);
  const tie = pickTeam(arsenal, [team({ id: 1 }), team({ id: 2, name: "Arsenal" })]);
  assert.equal(tie.team, null);
  assert.match(tie.reason, /tie risk/);
  assert.equal(pickTeam(arsenal, [team({ national_team: true })]).team, null);
  assert.match(pickTeam(arsenal, [team({ image_path: null })]).reason, /no image_path/);
});

test("searchQueries tries common_name first, then name, then the stripped name", () => {
  assert.deepEqual(searchQueries({ name: "FC St. Pauli" }), ["FC St. Pauli", "St. Pauli"]);
  assert.deepEqual(searchQueries({ name: "Paris Saint-Germain", common_name: "PSG" }), ["PSG", "Paris Saint-Germain", "Paris Saint-Germain"].filter((v, i, a) => a.indexOf(v) === i));
  assert.deepEqual(searchQueries({ name: "Arsenal" }), ["Arsenal"]);
});

test("sportmonksColours reads a colours field when one exists", () => {
  assert.equal(sportmonksColours(team()), null);
  assert.deepEqual(sportmonksColours({ colours: ["#d8232a", "0a111f"] }), { primary: "#D8232A", secondary: "#0A111F" });
  assert.deepEqual(sportmonksColours({ colours: "#D8232A" }), { primary: "#D8232A", secondary: null });
});

function pixels(list) {
  const buf = new Uint8Array(list.length * 4);
  list.forEach(([r, g, b, a = 255], i) => buf.set([r, g, b, a], i * 4));
  return buf;
}
const many = (rgb, n) => Array.from({ length: n }, () => rgb);

test("dominantColours skips white, black and transparent pixels", () => {
  const buf = pixels([
    ...many([255, 255, 255], 500),
    ...many([0, 0, 0], 500),
    ...many([10, 10, 10, 0], 500),
    ...many([200, 30, 40], 120),
    ...many([30, 60, 200], 60),
  ]);
  const c = dominantColours(buf);
  assert.equal(c.primary, "#C81E28");
  assert.equal(c.secondary, "#1E3CC8");
});

test("dominantColours returns a null secondary for a one-colour badge, null for none", () => {
  assert.equal(dominantColours(pixels([...many([200, 30, 40], 50), ...many([205, 33, 44], 50)])).secondary, null);
  assert.equal(dominantColours(pixels(many([255, 255, 255], 50))), null);
});

test("palette uses Sportmonks primary and secondary, keeping AA", () => {
  const p = leaguePalette("#7F7F7F", { primary: "#C81E28", secondary: "#F2EDE4" });
  assert.ok(contrast(p.primary, p.text) >= AA_TEXT);
  assert.equal(p.secondary, "#F2EDE4");
  assert.ok(contrast(p.secondary, p.primary) >= AA_GRAPHIC);
});

test("palette nudges a media primary that fails AA and replaces a weak accent", () => {
  const p = leaguePalette("#000000", { primary: "#7A7A7A", secondary: "#808080" });
  assert.ok(contrast(p.primary, p.text) >= AA_TEXT);
  assert.ok(contrast(p.secondary, p.primary) >= AA_GRAPHIC);
  assert.notEqual(p.secondary, "#808080");
});

test("palette falls back to club.color without media", () => {
  assert.deepEqual(leaguePalette("#1C4E9D", null), leaguePalette("#1C4E9D"));
  assert.equal(leaguePalette("#1C4E9D").primary, "#1C4E9D");
});

test("clubMedia is null for a club the script has not matched", () => {
  assert.equal(clubMedia("no-such-club"), null);
});

const T = (id, name) => ({ id, name, image_path: `https://cdn/${id}.png` });
const C = (slug, name, extra = {}) => ({ slug, name, competition: "X", ...extra });

test("teamKey drops accents, affixes and digit-only tokens", () => {
  assert.equal(teamKey("FC Bayern München"), "bayern munchen");
  assert.equal(teamKey("Bayer 04 Leverkusen"), "bayer leverkusen");
  assert.equal(teamKey("SSC Napoli"), "napoli");
  assert.equal(teamKey("Atlético Madrid"), "atletico madrid");
  assert.equal(teamKey("AC Milan"), "milan");
});

test("known aliases reach the Sportmonks names", () => {
  const cases = [
    [C("inter-milan", "Inter Milan"), T(1, "Inter")],
    [C("bayern-munich", "Bayern Munich"), T(2, "FC Bayern München")],
    [C("psg", "Paris Saint-Germain"), T(3, "Paris Saint Germain")],
    [C("atletico-madrid", "Atlético Madrid"), T(4, "Atlético de Madrid")],
    [C("marseille", "Olympique de Marseille"), T(5, "Olympique Marseille")],
    [C("bayer-leverkusen", "Bayer Leverkusen"), T(6, "Bayer 04 Leverkusen")],
    [C("napoli", "SSC Napoli"), T(7, "Napoli")],
  ];
  for (const [club, team] of cases) {
    const m = matchLeagueClubs([club], [team, T(99, "Somebody Else")]).get(club.slug);
    assert.equal(m.team?.id, team.id, club.slug);
  }
  assert.ok(clubKeys(C("inter-milan", "Inter Milan")).includes("inter"));
});

test("Paris FC cannot take Paris Saint-Germain's team", () => {
  const teams = [T(1, "Paris Saint Germain"), T(2, "Lyon")];
  const m = matchLeagueClubs([C("psg", "Paris Saint-Germain"), C("paris-fc", "Paris FC")], teams);
  assert.equal(m.get("psg").team.id, 1);
  assert.equal(m.get("paris-fc").team, null);
});

test("partial names match, ambiguity and missing images do not", () => {
  const wolves = matchLeagueClubs([C("wolves", "Wolverhampton")], [T(1, "Wolverhampton Wanderers")]);
  assert.equal(wolves.get("wolves").team.id, 1);
  const amb = matchLeagueClubs([C("x", "Manchester")], [T(1, "Manchester United"), T(2, "Manchester City")]);
  assert.match(amb.get("x").reason, /ambiguous/);
  const noImg = matchLeagueClubs([C("a", "Arsenal")], [{ id: 1, name: "Arsenal", image_path: null }]);
  assert.match(noImg.get("a").reason, /no image_path/);
});

test("two clubs on one team are both dropped", () => {
  const m = matchLeagueClubs([C("a", "Sporting Gijon"), C("b", "Real Gijon")], [T(1, "Gijon")]);
  assert.equal(m.get("a").team, null);
  assert.match(m.get("b").reason, /claimed by/);
});

test("resolveLeagues prefers Ultima env ids, then discovers by country and exact name", () => {
  const rows = [
    { id: 8, name: "Premier League", country: { name: "England" } },
    { id: 9, name: "Championship", country: { name: "England" } },
    { id: 82, name: "Bundesliga", country: { name: "Germany" } },
    { id: 83, name: "2. Bundesliga", country: { name: "Germany" } },
    { id: 70, name: "Premier League", country: { name: "Russia" } },
  ];
  const r = resolveLeagues(rows, { SPORTMONKS_LEAGUE_ID_PL: "777" });
  assert.deepEqual(r["Premier League"], { id: 777, name: "Premier League", source: "env" });
  assert.equal(r.Championship.id, 9);
  assert.equal(r.Bundesliga.id, 82);
  assert.equal(r["2. Bundesliga"].id, 83);
  assert.equal(r["Serie A"], null);
  assert.equal(resolveLeagues(rows, {})["Premier League"].id, 8);
});

test("every Crest competition has a league matcher", () => {
  for (const c of CREST_COMPETITIONS) assert.ok(LEAGUE_MATCHERS[c], c);
  for (const c of new Set(CLUBS.map((k) => k.competition).filter(Boolean))) assert.ok(LEAGUE_MATCHERS[c], c);
});

test("unmatchedCategory separates outside-plan from truly not found", () => {
  const club = { slug: "x", name: "X", competition: "Eredivisie" };
  assert.equal(unmatchedCategory(club, { status: "outside_plan" }, "").category, "league_outside_plan");
  assert.equal(unmatchedCategory(club, { status: "unresolved" }, "").category, "league_outside_plan");
  assert.equal(unmatchedCategory(club, { status: "empty_season" }, "").category, "league_empty_season");
  const nf = unmatchedCategory(club, { status: "ok", teams: 18 }, "search: no candidates");
  assert.equal(nf.category, "not_found");
  assert.match(nf.reason, /18 Eredivisie teams/);
  assert.equal(unmatchedCategory({ slug: "y", name: "Y" }, null, "").category, "no_competition");
});

test("parseOverride accepts an id, a badge or colours and rejects junk", () => {
  assert.deepEqual(parseOverride({ sportmonks_id: 19 }).value, { sportmonks_id: 19 });
  assert.deepEqual(
    parseOverride({ badge_url: "https://cdn/x.png", primary: "#c81e28", secondary: "#f2ede4" }).value,
    { badge_url: "https://cdn/x.png", primary: "#C81E28", secondary: "#F2EDE4" },
  );
  assert.ok(parseOverride({}).error);
  assert.ok(parseOverride({ sportmonks_id: "abc" }).error);
  assert.ok(parseOverride({ badge_url: "http://insecure/x.png" }).error);
  assert.ok(parseOverride({ sportmonks_id: 1, primary: "red" }).error);
});
