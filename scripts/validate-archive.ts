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
const LENS_VOICES = new Set(["historian", "psychologist", "sceptic"]);

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

function validateLenses(
  lenses: Record<string, unknown>[],
  knownIds: Set<string>,
  errors: string[],
) {
  const seenEntryIds = new Set<string>();

  for (const record of lenses) {
    const entryId = String(record.entryId ?? "");
    if (!entryId) {
      errors.push("lens record missing entryId");
      continue;
    }
    if (!knownIds.has(entryId)) {
      errors.push(
        `lenses ${entryId}: entryId not found in entries.json or holding.json`,
      );
    }
    if (seenEntryIds.has(entryId)) {
      errors.push(`lenses ${entryId}: duplicate lens record for entryId`);
    }
    seenEntryIds.add(entryId);

    const passages = record.lenses;
    if (!Array.isArray(passages)) {
      errors.push(`lenses ${entryId}: lenses must be an array`);
      continue;
    }

    const voicesSeen = new Set<string>();
    for (const passage of passages) {
      const voice = String((passage as { voice?: string }).voice ?? "");
      const text = String((passage as { text?: string }).text ?? "");

      if (!LENS_VOICES.has(voice)) {
        errors.push(
          `lenses ${entryId}: invalid voice ${JSON.stringify(voice)}`,
        );
      }
      if (voicesSeen.has(voice)) {
        errors.push(
          `lenses ${entryId}: more than one lens for voice '${voice}'`,
        );
      }
      voicesSeen.add(voice);

      const words = wordCount(text);
      if (!text.trim()) {
        errors.push(`lenses ${entryId} (${voice}): text is empty`);
      } else if (words > 60) {
        errors.push(
          `lenses ${entryId} (${voice}): text has ${words} words (max 60)`,
        );
      }
    }
  }
}

function main() {
  const errors: string[] = [];
  const entriesPath = path.join(ARCHIVE_DIR, "entries.json");
  const holdingPath = path.join(ARCHIVE_DIR, "holding.json");
  const quarantinePath = path.join(ARCHIVE_DIR, "quarantine.json");
  const lensesPath = path.join(ARCHIVE_DIR, "lenses.json");

  for (const filePath of [
    entriesPath,
    holdingPath,
    quarantinePath,
    lensesPath,
  ]) {
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
  const lenses = loadJson(lensesPath) as Record<string, unknown>[];

  if (!Array.isArray(entries)) errors.push("entries.json must be an array");
  if (!Array.isArray(holding)) errors.push("holding.json must be an array");
  if (!Array.isArray(quarantine)) {
    errors.push("quarantine.json must be an array");
  }
  if (!Array.isArray(lenses)) errors.push("lenses.json must be an array");

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

  validateLenses(lenses, new Set(seen.keys()), errors);

  const holdingCount = holding.length;
  console.log(
    `[archive] holding=${holdingCount} published=${entries.length} quarantine=${quarantine.length} lenses=${lenses.length}`,
  );

  if (errors.length) {
    for (const error of errors) console.error(`FAIL ${error}`);
    console.error(`[archive] validation failed with ${errors.length} error(s)`);
    process.exit(1);
  }

  console.log("[archive] validation passed");
}

main();
