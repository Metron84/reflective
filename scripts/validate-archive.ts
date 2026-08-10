#!/usr/bin/env node
/**
 * Validate The Beautiful Archive content JSON.
 * Run: npm run validate:archive
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const ARCHIVE_DIR = path.join(ROOT, "content/archive");

const MEDIUMS = new Set([
  "documentary",
  "docuseries",
  "film",
  "book",
  "photography",
  "music",
  "artwork",
  "museum",
  "exhibition",
]);
const REGIONS = new Set([
  "Europe",
  "South America",
  "North America",
  "Africa",
  "Asia",
  "Middle East",
  "Oceania",
  "International",
]);
const SUBJECTS = new Set([
  "club",
  "nation",
  "player",
  "fans",
  "tournament",
  "culture",
  "politics",
  "tactics",
]);
const TONES = new Set([
  "light",
  "serious",
  "elegiac",
  "aerial",
  "angry",
  "celebratory",
  "investigative",
]);
const DIFFICULTIES = new Set(["newcomer", "familiar", "deep"]);
const CONFIDENCES = new Set(["high", "medium", "low"]);
const STATUSES = new Set(["published", "holding"]);

function loadJson(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function wordCount(text: string) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function validateEntry(
  entry: Record<string, unknown>,
  source: string,
  errors: string[],
) {
  const id = String(entry.id ?? "(missing id)");
  const prefix = `${source} ${id}`;

  if (!MEDIUMS.has(entry.medium as string)) {
    errors.push(`${prefix}: invalid medium ${JSON.stringify(entry.medium)}`);
  }
  if (!REGIONS.has(entry.region as string)) {
    errors.push(`${prefix}: invalid region ${JSON.stringify(entry.region)}`);
  }
  if (!SUBJECTS.has(entry.subject as string)) {
    errors.push(`${prefix}: invalid subject ${JSON.stringify(entry.subject)}`);
  }
  if (!TONES.has(entry.tone as string)) {
    errors.push(`${prefix}: invalid tone ${JSON.stringify(entry.tone)}`);
  }
  if (!DIFFICULTIES.has(entry.difficulty as string)) {
    errors.push(
      `${prefix}: invalid difficulty ${JSON.stringify(entry.difficulty)}`,
    );
  }
  if (!CONFIDENCES.has(entry.confidence as string)) {
    errors.push(
      `${prefix}: invalid confidence ${JSON.stringify(entry.confidence)}`,
    );
  }
  if (!STATUSES.has(entry.status as string)) {
    errors.push(`${prefix}: invalid status ${JSON.stringify(entry.status)}`);
  }

  if (entry.status === "published" && entry.confidence === "low") {
    errors.push(`${prefix}: published entry cannot have confidence 'low'`);
  }
  if (entry.status === "published" && entry.verified !== true) {
    errors.push(`${prefix}: published entry must have verified true`);
  }

  const loglineWords = wordCount(entry.logline as string);
  if (loglineWords > 25) {
    errors.push(`${prefix}: logline has ${loglineWords} words (max 25)`);
  }
  const whyWords = wordCount(entry.whyItMatters as string);
  if (whyWords > 30) {
    errors.push(`${prefix}: whyItMatters has ${whyWords} words (max 30)`);
  }

  const sourceUrl = entry.sourceUrl as string;
  if (!sourceUrl || !isHttpUrl(sourceUrl)) {
    errors.push(
      `${prefix}: sourceUrl must be a valid http(s) URL (got ${JSON.stringify(sourceUrl)})`,
    );
  }
}

function main() {
  const errors: string[] = [];
  const entriesPath = path.join(ARCHIVE_DIR, "entries.json");
  const holdingPath = path.join(ARCHIVE_DIR, "holding.json");
  const quarantinePath = path.join(ARCHIVE_DIR, "quarantine.json");

  for (const filePath of [entriesPath, holdingPath, quarantinePath]) {
    if (!fs.existsSync(filePath)) {
      errors.push(`missing ${filePath}`);
    }
  }
  if (errors.length) {
    for (const error of errors) console.error(`FAIL ${error}`);
    process.exit(1);
  }

  const entries = loadJson(entriesPath) as Record<string, unknown>[];
  const holding = loadJson(holdingPath) as Record<string, unknown>[];
  const quarantine = loadJson(quarantinePath) as Record<string, unknown>[];

  if (!Array.isArray(entries)) errors.push("entries.json must be an array");
  if (!Array.isArray(holding)) errors.push("holding.json must be an array");
  if (!Array.isArray(quarantine)) {
    errors.push("quarantine.json must be an array");
  }

  const allEntries = [...entries, ...holding];
  const seen = new Map<string, string>();
  for (const entry of allEntries) {
    const id = String(entry.id ?? "");
    if (!id) {
      errors.push("entry missing id");
      continue;
    }
    if (seen.has(id)) {
      errors.push(`duplicate id '${id}' in ${seen.get(id)} and current file`);
    } else {
      seen.set(id, String(entry.status ?? "unknown"));
    }
  }

  for (const entry of entries) validateEntry(entry, "entries", errors);
  for (const entry of holding) validateEntry(entry, "holding", errors);

  for (const item of quarantine) {
    if (!item || typeof item.title !== "string" || !item.title.trim()) {
      errors.push("quarantine item missing title");
    }
    if (!item || typeof item.reason !== "string" || !item.reason.trim()) {
      errors.push("quarantine item missing reason");
    }
  }

  const holdingCount = holding.length;
  console.log(
    `[archive] holding=${holdingCount} published=${entries.length} quarantine=${quarantine.length}`,
  );

  if (errors.length) {
    for (const error of errors) console.error(`FAIL ${error}`);
    console.error(`[archive] validation failed with ${errors.length} error(s)`);
    process.exit(1);
  }

  console.log("[archive] validation passed");
}

main();
