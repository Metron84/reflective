/**
 * Stamp `competition` on every club in lib/crest/clubs.js from the 2026-27
 * league lists. Does not invent tables. Rest of the World uses country ->
 * top-flight mapping in lib/crest/competitions.js.
 *
 *   node scripts/stamp-crest-competitions.mjs           # dry run
 *   node scripts/stamp-crest-competitions.mjs --write
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CLUBS } from "../lib/crest/clubs.js";
import { COUNTRY_COMPETITION } from "../lib/crest/competitions.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LIST_DIR = join(ROOT, "scripts/crest/league-lists");
const CLUBS_PATH = join(ROOT, "lib/crest/clubs.js");
const WRITE = process.argv.includes("--write");

const FILE_TO_COMP = {
  "Premier_League_2026-27.json": "Premier League",
  "LaLiga_2026-27.json": "LaLiga",
  "Serie_A_2026-27.json": "Serie A",
  "Bundesliga_2026-27.json": "Bundesliga",
  "Ligue_1_2026-27.json": "Ligue 1",
};

function normalize(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function variants(name) {
  const n = normalize(name);
  const stripped = n
    .replace(/^(1 |1 fc |fc |cf |afc |ac |acf |as |aj |ogc |rc |ss |ssc |us |ud |rcd |ca |sk |gnk |tsg |sv |vfl |vfb |sc |estac |losc |lr |olympique |olympique de )/, "")
    .replace(/ (fc|cf|cfc|ac|ud|osc|sco|1907|calcio|alsace)$/, "")
    .trim();
  return [...new Set([n, stripped, n.replace(/ /g, "-"), stripped.replace(/ /g, "-")])];
}

function clubIndex() {
  const map = new Map();
  for (const club of CLUBS) {
    for (const key of [...variants(club.name), ...variants(club.slug.replace(/-/g, " ")), club.slug]) {
      if (key) map.set(key, club);
    }
  }
  map.set("brighton and hove albion", bySlugLookup("brighton"));
  map.set("paris saint germain", bySlugLookup("psg"));
  map.set("stade rennais", bySlugLookup("rennes"));
  map.set("stade brestois", bySlugLookup("brest"));
  map.set("stade brestois 29", bySlugLookup("brest"));
  map.set("athletic bilbao", bySlugLookup("athletic-bilbao"));
  map.set("lr vicenza", bySlugLookup("vicenza"));
  map.set("sc paderborn", bySlugLookup("sc-paderborn-07"));
  map.set("paderborn", bySlugLookup("sc-paderborn-07"));
  return map;
}

function bySlugLookup(slug) {
  return CLUBS.find((c) => c.slug === slug);
}

function resolve(index, row) {
  const names = [row.name, row.common_name].filter(Boolean);
  for (const name of names) {
    for (const key of variants(name)) {
      const hit = index.get(key);
      if (hit) return hit;
    }
  }
  return null;
}

const assigned = Object.fromEntries(CLUBS.map((c) => [c.slug, null]));
const listMissing = [];
const collisions = [];
const index = clubIndex();

for (const [file, competition] of Object.entries(FILE_TO_COMP)) {
  const data = JSON.parse(readFileSync(join(LIST_DIR, file), "utf8"));
  const clubs = data.filter((row) => row.name && !row.source);
  for (const row of clubs) {
    const club = resolve(index, row);
    if (!club) {
      listMissing.push({ competition, name: row.name });
      continue;
    }
    if (assigned[club.slug] && assigned[club.slug] !== competition) {
      collisions.push({ slug: club.slug, a: assigned[club.slug], b: competition });
    }
    assigned[club.slug] = competition;
  }
}

for (const club of CLUBS) {
  if (assigned[club.slug]) continue;
  const fromCountry = COUNTRY_COMPETITION[club.country];
  if (fromCountry) assigned[club.slug] = fromCountry;
}

const unmatched = CLUBS.filter((c) => !assigned[c.slug]);

console.log("assigned", Object.values(assigned).filter(Boolean).length, "/", CLUBS.length);
console.log("\non a list, not in clubs.js");
for (const row of listMissing) console.log(`  ${row.competition.padEnd(18)} ${row.name}`);
console.log("\nlive clubs with no competition");
for (const club of unmatched) console.log(`  ${club.slug}  ${club.name}  ${club.group}`);
if (collisions.length) {
  console.log("\nCOLLISIONS");
  for (const row of collisions) console.log(`  ${row.slug} ${row.a} vs ${row.b}`);
}

const counts = {};
for (const value of Object.values(assigned)) {
  if (!value) continue;
  counts[value] = (counts[value] || 0) + 1;
}
console.log("\ncounts");
for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(22)} ${v}`);
}

if (collisions.length) process.exit(1);

if (!WRITE) {
  console.log("\ndry run. pass --write to stamp lib/crest/clubs.js");
  process.exit(0);
}

let src = readFileSync(CLUBS_PATH, "utf8");
if (src.includes("competition:")) {
  console.error("clubs.js already has competition fields. Abort.");
  process.exit(1);
}

src = src.replace(
  /slug: "([^"]+)",\n    name: "([^"]+)",\n    group: "([^"]+)",\n    country: "([^"]+)",/g,
  (full, slug, name, group, country) => {
    const competition = assigned[slug];
    const value = competition ? `"${competition}"` : "null";
    return `slug: "${slug}",\n    name: "${name}",\n    group: "${group}",\n    country: "${country}",\n    competition: ${value},`;
  },
);

if (!src.includes('competition: "Premier League"')) {
  console.error("stamp did not insert competitions. Abort.");
  process.exit(1);
}

const typedef = ` * @property {string} country
 * @property {number} confidence`;
const typedefNext = ` * @property {string} country
 * @property {string|null} competition
 * @property {number} confidence`;
if (!src.includes(typedef)) {
  console.error("typedef country block not found");
  process.exit(1);
}
src = src.replace(typedef, typedefNext);

writeFileSync(CLUBS_PATH, src);
console.log(`\nwrote ${CLUBS_PATH}`);
