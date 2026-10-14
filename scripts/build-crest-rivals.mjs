/**
 * Builds lib/crest/rivals.json, the rivalry map the Crest league reveal uses.
 *
 *   node scripts/build-crest-rivals.mjs
 *
 * Exactly two sources, nothing else:
 *   1. scripts/crest/rival-pairs.txt        one "slug|slug" pair per line, treated as two-way
 *   2. public/crest/clubs.json              each club's exclusion_clubs (derby rivals), made two-way
 * Slugs are mapped (paris-saint-germain -> psg, 1-fc-nurnberg -> nurnberg). Any pair with a slug
 * that is not a Crest club in lib/crest/clubs.js is dropped and reported. Never edit rivals.json
 * by hand: change a source and rerun this.
 *
 * Output shape: { "arsenal": ["chelsea", "tottenham-hotspur"], ... }, keys and lists sorted,
 * every pair present on both sides.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CLUBS } from "../lib/crest/clubs.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SLUG_MAP = { "paris-saint-germain": "psg", "1-fc-nurnberg": "nurnberg" };
const map = (slug) => SLUG_MAP[slug] ?? slug;
const crest = new Set(CLUBS.map((c) => c.slug));

const pairs = new Map(); // "a|b" (sorted) -> sources
const dropped = [];
function add(a, b, source) {
  const [x, y] = [map(a), map(b)];
  if (x === y) return;
  const bad = [x, y].filter((s) => !crest.has(s));
  if (bad.length) {
    dropped.push({ pair: `${x}|${y}`, source, notCrest: bad });
    return;
  }
  const key = [x, y].sort().join("|");
  pairs.set(key, [...new Set([...(pairs.get(key) ?? []), source])]);
}

const given = readFileSync(join(ROOT, "scripts/crest/rival-pairs.txt"), "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter(Boolean);
for (const line of given) {
  const [a, b] = line.split("|");
  add(a, b, "pairs");
}

const snapshot = JSON.parse(readFileSync(join(ROOT, "public/crest/clubs.json"), "utf8"));
for (const row of snapshot) {
  for (const rival of row.exclusion_clubs ?? []) add(row.slug, rival, "snapshot");
}

const rivals = {};
for (const key of pairs.keys()) {
  const [a, b] = key.split("|");
  (rivals[a] ??= []).push(b);
  (rivals[b] ??= []).push(a);
}
const sorted = Object.fromEntries(
  Object.entries(rivals)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => [k, v.sort()]),
);

const fromPairs = [...pairs.values()].filter((s) => s.includes("pairs")).length;
const fromSnapshotOnly = [...pairs.values()].filter((s) => !s.includes("pairs")).length;
console.log(`Pairs in the list: ${given.length}. Kept from the list: ${fromPairs}.`);
console.log(`Added from exclusion_clubs only: ${fromSnapshotOnly}. Total pairs: ${pairs.size}.`);
console.log(`Clubs with at least one rival: ${Object.keys(sorted).length} of ${CLUBS.length}.`);
const dropList = dropped.filter((d) => d.source === "pairs");
const dropSnap = dropped.filter((d) => d.source === "snapshot");
console.log(`\nDropped, list pairs with a non-Crest slug (${dropList.length}):`);
for (const d of dropList) console.log(`  ${d.pair}  (not a Crest club: ${d.notCrest.join(", ")})`);
console.log(`\nDropped, exclusion_clubs pairs with a non-Crest slug (${dropSnap.length}):`);
for (const d of dropSnap) console.log(`  ${d.pair}  (not a Crest club: ${d.notCrest.join(", ")})`);

writeFileSync(join(ROOT, "lib/crest/rivals.json"), JSON.stringify(sorted, null, 2) + "\n");
console.log("\nWrote lib/crest/rivals.json");
