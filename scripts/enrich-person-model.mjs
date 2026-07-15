// Assigns person_id and canonical flags to data/players_seed.json.
// Run: node scripts/enrich-person-model.mjs
// Idempotent — safe to re-run when Melo drops an updated seed.

import { readFileSync, writeFileSync } from "fs";
import crypto from "crypto";

const MODE_PRIORITY = [
  "la_liga",
  "premier_league",
  "serie_a",
  "bundesliga",
  "ligue_1",
  "world_cup",
];

function normalize(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/gi, "")
    .toLowerCase()
    .trim();
}

function personIdForName(name) {
  const base = normalize(name);
  return crypto
    .createHash("sha256")
    .update(`trf-person:${base}`)
    .digest("hex")
    .slice(0, 12);
}

function pickCanonical(rows) {
  const withLeague = rows.filter((r) => r.league != null);
  const pool = withLeague.length ? withLeague : [...rows];
  pool.sort((a, b) => {
    const ai = MODE_PRIORITY.indexOf(a.category);
    const bi = MODE_PRIORITY.indexOf(b.category);
    const ar = ai === -1 ? 99 : ai;
    const br = bi === -1 ? 99 : bi;
    if (ar !== br) return ar - br;
    const spanA = (a.era_end ?? a.era_start ?? 0) - (a.era_start ?? 0);
    const spanB = (b.era_end ?? b.era_start ?? 0) - (b.era_start ?? 0);
    return spanB - spanA;
  });
  return pool[0].id;
}

const seedPath = "data/players_seed.json";
const seed = JSON.parse(readFileSync(seedPath, "utf8"));

const byPerson = new Map();
for (const row of seed.players) {
  const person_id = row.person_id ?? personIdForName(row.name);
  if (!byPerson.has(person_id)) byPerson.set(person_id, []);
  byPerson.get(person_id).push(row);
}

const canonicalIds = new Map();
for (const [pid, rows] of byPerson) {
  canonicalIds.set(pid, pickCanonical(rows));
}

const cluesByPerson = new Map();
for (const [pid, rows] of byPerson) {
  const canonical = rows.find((r) => r.id === canonicalIds.get(pid)) ?? rows[0];
  cluesByPerson.set(pid, canonical.clues ?? []);
}

let updated = 0;
seed.players = seed.players.map((row) => {
  const person_id = row.person_id ?? personIdForName(row.name);
  const canonical = row.id === canonicalIds.get(person_id);
  const clues = cluesByPerson.get(person_id) ?? row.clues ?? [];
  if (
    row.person_id !== person_id ||
    row.canonical !== canonical ||
    JSON.stringify(row.clues) !== JSON.stringify(clues)
  ) {
    updated += 1;
  }
  return { ...row, person_id, canonical, clues };
});

seed.person_model = {
  version: 2,
  enriched: new Date().toISOString().slice(0, 10),
  persons: byPerson.size,
  note: "person_id groups rows of the same human; canonical marks best-known era row.",
};

writeFileSync(seedPath, `${JSON.stringify(seed, null, 2)}\n`);
console.log(
  `Enriched ${seed.players.length} rows across ${byPerson.size} persons (${updated} rows updated).`
);
