#!/usr/bin/env node
/**
 * Merges league files, drops Tier A duplicates, assigns slugs, writes batches of 20.
 *
 * Usage (from repo root): node scripts/crest/prepare-tier-b-batches.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const LEAGUE_DIR = path.join(ROOT, "data/leagues");
const TIER_A_PATH = path.join(ROOT, "data/tier-a/clubs.json");
const OUT_DIR = path.join(ROOT, "data/tier-b/batches");
const BATCH_SIZE = 20;

const LEAGUES = [
  "serie-a",
  "laliga",
  "bundesliga",
  "ligue-1",
  "serie-b",
  "laliga-2",
  "2-bundesliga",
  "ligue-2",
  "efl-championship",
  "efl-league-one",
];

const COMPETITION_LABEL = {
  "serie-a": "Serie A",
  laliga: "LaLiga",
  bundesliga: "Bundesliga",
  "ligue-1": "Ligue 1",
  "serie-b": "Serie B",
  "laliga-2": "LaLiga 2",
  "2-bundesliga": "2. Bundesliga",
  "ligue-2": "Ligue 2",
  "efl-championship": "EFL Championship",
  "efl-league-one": "EFL League One",
};

function normalize(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function slugify(name) {
  return normalize(name).replace(/\s+/g, "-");
}

function loadTierANames() {
  if (!fs.existsSync(TIER_A_PATH)) return new Set();
  const clubs = JSON.parse(fs.readFileSync(TIER_A_PATH, "utf8"));
  const names = new Set();
  for (const c of clubs) {
    names.add(normalize(c.name));
    if (c.common_name) names.add(normalize(c.common_name));
    if (c.slug === "marseille") names.add(normalize("Olympique Marseille"));
    if (c.slug === "st-pauli") {
      names.add(normalize("FC St. Pauli"));
      names.add(normalize("FC St Pauli"));
    }
  }
  return names;
}

function main() {
  const tierANames = loadTierANames();
  const merged = [];
  const seenSlugs = new Set();

  for (const comp of LEAGUES) {
    const file = path.join(LEAGUE_DIR, `${comp}.json`);
    if (!fs.existsSync(file)) {
      console.error(`Missing ${file}. Run validate-league-lists.mjs first.`);
      process.exit(1);
    }
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    const trailer = data[data.length - 1];
    const clubs = data.slice(0, -1);

    for (const club of clubs) {
      const key = normalize(club.common_name || club.name);
      if (tierANames.has(key)) continue;

      let slug = slugify(club.common_name || club.name);
      if (seenSlugs.has(slug)) slug = `${slug}-${slugify(club.city || comp)}`;
      seenSlugs.add(slug);

      merged.push({
        slug,
        name: club.name,
        common_name: club.common_name || club.name,
        city: club.city || "",
        country: club.country || "",
        founded: club.founded || 0,
        competition: COMPETITION_LABEL[comp] ?? comp,
        competition_slug: comp,
        source: trailer?.source || "",
        as_of: trailer?.as_of || "",
      });
    }
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const batchCount = Math.ceil(merged.length / BATCH_SIZE);

  for (let i = 0; i < batchCount; i++) {
    const batch = merged.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
    const num = String(i + 1).padStart(3, "0");
    fs.writeFileSync(
      path.join(OUT_DIR, `${num}.json`),
      `${JSON.stringify(batch, null, 2)}\n`,
    );
  }

  fs.writeFileSync(
    path.join(ROOT, "data/tier-b/queue-summary.json"),
    `${JSON.stringify(
      {
        tier_b_club_count: merged.length,
        batch_count: batchCount,
        batch_size: BATCH_SIZE,
        generated_at: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );

  console.log(
    `Prepared ${merged.length} Tier B clubs across ${batchCount} batches of up to ${BATCH_SIZE}.`,
  );
  console.log(`Batches written to data/tier-b/batches/`);
}

main();
