#!/usr/bin/env node
/**
 * Checks each Step-1 league JSON file against expected counts and trailer object.
 * Flags Tier A name overlaps (exclude from Tier B, do not re-score).
 *
 * Usage (from repo root): node scripts/crest/validate-league-lists.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const LEAGUE_DIR = path.join(ROOT, "data/leagues");
const TIER_A_PATH = path.join(ROOT, "data/tier-a/clubs.json");

const EXPECTED_COUNTS = {
  "serie-a": 20,
  laliga: 20,
  bundesliga: 18,
  "ligue-1": 18,
  "serie-b": 20,
  "laliga-2": 22,
  "2-bundesliga": 18,
  "ligue-2": 18,
  "efl-championship": 24,
  "efl-league-one": 24,
};

function normalize(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function loadTierANames() {
  if (!fs.existsSync(TIER_A_PATH)) {
    console.warn(`WARN: Tier A roster not found at ${TIER_A_PATH}. Skipping dedup check.`);
    return new Set();
  }
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
  let hasError = false;
  const tierANames = loadTierANames();

  for (const [comp, expected] of Object.entries(EXPECTED_COUNTS)) {
    const file = path.join(LEAGUE_DIR, `${comp}.json`);
    if (!fs.existsSync(file)) {
      console.error(`FAIL [${comp}]: missing file data/leagues/${comp}.json`);
      hasError = true;
      continue;
    }

    let data;
    try {
      data = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (e) {
      console.error(`FAIL [${comp}]: invalid JSON (${e.message})`);
      hasError = true;
      continue;
    }

    if (!Array.isArray(data) || data.length === 0) {
      console.error(`FAIL [${comp}]: expected a non-empty array`);
      hasError = true;
      continue;
    }

    const trailer = data[data.length - 1];
    const clubs = data.slice(0, -1);

    if (!trailer || typeof trailer.source !== "string" || !trailer.source) {
      console.error(`FAIL [${comp}]: missing trailing {"source","as_of"} object`);
      hasError = true;
    } else if (!trailer.as_of) {
      console.error(`FAIL [${comp}]: trailer object missing "as_of"`);
      hasError = true;
    }

    if (clubs.length !== expected) {
      console.error(`FAIL [${comp}]: expected ${expected} clubs, found ${clubs.length}`);
      hasError = true;
    } else {
      console.log(`OK   [${comp}]: ${clubs.length} clubs, source=${trailer?.source ?? "MISSING"}`);
    }

    for (const club of clubs) {
      if (!club.name) {
        console.error(`FAIL [${comp}]: club entry missing "name": ${JSON.stringify(club)}`);
        hasError = true;
        continue;
      }
      const key = normalize(club.common_name || club.name);
      if (tierANames.has(key)) {
        console.warn(
          `DEDUP [${comp}]: "${club.name}" matches an existing Tier A club — exclude from Tier B batches.`,
        );
      }
    }
  }

  if (hasError) {
    console.error(
      "\nValidation failed. Re-run the Step 1 Perplexity prompt for any FAILed competition. Do not hand-edit the JSON.",
    );
    process.exit(1);
  }
  console.log("\nAll league lists validated.");
}

main();
