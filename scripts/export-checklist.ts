#!/usr/bin/env node
/**
 * Export Beautiful Archive holding rows for hand verification.
 * Run: npm run export:checklist
 * Writes exports/archive-checklist.csv
 * Not wired into build.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const HOLDING_PATH = path.join(ROOT, "content/archive/holding.json");
const EXPORTS_DIR = path.join(ROOT, "exports");

const MEDIUM_ORDER = [
  "film",
  "music",
  "artwork",
  "photography",
  "book",
  "docuseries",
  "documentary",
  "museum",
] as const;

type HoldingEntry = {
  id: string;
  medium: string;
  title: string;
  creator: string;
  year: number | null;
  country: string;
  region: string;
  subject: string;
  tone: string;
  difficulty: string;
  confidence: string;
  sourceUrl: string;
  whereToFind?: string;
  availabilityNote?: string;
};

const CHECKLIST_HEADERS = [
  "order",
  "id",
  "medium",
  "title",
  "creator",
  "year",
  "country",
  "region",
  "subject",
  "tone",
  "difficulty",
  "confidence",
  "riskFlags",
  "sourceUrl",
  "checked",
  "creatorOk",
  "yearOk",
  "availabilityOk",
  "decision",
  "correctionNeeded",
  "notes",
] as const;

function loadHolding(): HoldingEntry[] {
  const raw = JSON.parse(fs.readFileSync(HOLDING_PATH, "utf8"));
  if (!Array.isArray(raw)) {
    throw new Error("holding.json must be an array");
  }
  return raw as HoldingEntry[];
}

function csvEscape(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function rowToCsv(values: Array<string | number | null | undefined>): string {
  return values.map(csvEscape).join(",");
}

function sourceHost(sourceUrl: string): string {
  try {
    return new URL(sourceUrl).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function artworkNamesInstitution(whereToFind: string | undefined): boolean {
  const text = String(whereToFind || "");
  return /\b(museum|gallery|stadium|collection|institute|foundation|library|biennale|moma|tate|louvre|wembley|old trafford|national football museum|factory international|uefa)\b/i.test(
    text,
  );
}

function riskFlags(entry: HoldingEntry): string {
  const flags: string[] = [];

  if (entry.confidence === "low") flags.push("low confidence");
  if (typeof entry.year === "number" && entry.year >= 2026) {
    flags.push("year 2026 or later");
  }

  const host = sourceHost(entry.sourceUrl);
  if (host.includes("wikipedia") || host.includes("imdb")) {
    flags.push("weak source host");
  }

  const availability = String(entry.availabilityNote || "");
  if (
    /\bLimited\b/.test(availability) ||
    /\bOut of print\b/i.test(availability) ||
    /\bvaries\b/i.test(availability)
  ) {
    flags.push("availability risk");
  }

  if (entry.medium === "museum") flags.push("recheck annually");

  if (
    entry.medium === "artwork" &&
    !artworkNamesInstitution(entry.whereToFind)
  ) {
    flags.push("no institution named");
  }

  return flags.join("|");
}

function mediumRank(medium: string): number {
  const index = MEDIUM_ORDER.indexOf(medium as (typeof MEDIUM_ORDER)[number]);
  return index === -1 ? MEDIUM_ORDER.length : index;
}

function writeChecklist(holding: HoldingEntry[]) {
  const sorted = [...holding].sort((a, b) => {
    const byMedium = mediumRank(a.medium) - mediumRank(b.medium);
    if (byMedium !== 0) return byMedium;
    return a.title.localeCompare(b.title, "en", { sensitivity: "base" });
  });

  const lines = [CHECKLIST_HEADERS.join(",")];
  sorted.forEach((entry, index) => {
    lines.push(
      rowToCsv([
        index + 1,
        entry.id,
        entry.medium,
        entry.title,
        entry.creator,
        entry.year,
        entry.country,
        entry.region,
        entry.subject,
        entry.tone,
        entry.difficulty,
        entry.confidence,
        riskFlags(entry),
        entry.sourceUrl,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ]),
    );
  });

  const outPath = path.join(EXPORTS_DIR, "archive-checklist.csv");
  fs.writeFileSync(outPath, `${lines.join("\n")}\n`);
  return { outPath, count: sorted.length };
}

function main() {
  const holding = loadHolding();
  fs.mkdirSync(EXPORTS_DIR, { recursive: true });

  const checklist = writeChecklist(holding);

  console.log(
    `[export:checklist] wrote ${checklist.count} rows → ${path.relative(ROOT, checklist.outPath)}`,
  );
}

main();
