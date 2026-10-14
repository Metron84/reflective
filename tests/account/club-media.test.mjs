import test from "node:test";
import assert from "node:assert/strict";
import {
  dominantColours,
  pickTeam,
  searchQueries,
  sportmonksColours,
} from "@/lib/crest/media-match.js";
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

test("searchQueries adds a version without generic prefixes", () => {
  assert.deepEqual(searchQueries({ name: "FC St. Pauli" }), ["FC St. Pauli", "St. Pauli"]);
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
