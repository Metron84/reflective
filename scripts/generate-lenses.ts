#!/usr/bin/env node
/**
 * LOCAL-ONLY Archive Lens draft generator.
 *
 * Reads content/archive/entries.json, skips entries that already have lenses
 * in content/archive/lenses.json, calls a local Ollama endpoint, and writes
 * content/archive/lenses.draft.json.
 *
 * Output is a draft and must be edited by hand before being promoted to
 * lenses.json. Never run this during build or deploy.
 *
 * Usage: npm run generate:archive-lenses
 * Requires Ollama at http://localhost:11434 (optional OLLAMA_MODEL env).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const ARCHIVE_DIR = path.join(ROOT, "content/archive");
const ENTRIES_PATH = path.join(ARCHIVE_DIR, "entries.json");
const LENSES_PATH = path.join(ARCHIVE_DIR, "lenses.json");
const DRAFT_PATH = path.join(ARCHIVE_DIR, "lenses.draft.json");

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2";

const VOICES = ["historian", "psychologist", "sceptic"] as const;

type Entry = {
  id: string;
  title: string;
  creator: string;
  year: number | null;
  country: string;
  subjectName: string;
  logline: string;
  whyItMatters: string;
};

type LensPassage = { voice: (typeof VOICES)[number]; text: string };
type LensRecord = { entryId: string; lenses: LensPassage[] };

function loadJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function wordCount(text: string) {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function voiceBrief(voice: (typeof VOICES)[number]) {
  if (voice === "historian") {
    return "Write as a football historian: context, lineage, what the work preserves.";
  }
  if (voice === "psychologist") {
    return "Write as a psychologist of fandom: desire, belonging, projection, emotion.";
  }
  return "Write as a sceptic: limits, blind spots, what the work may overclaim.";
}

async function generatePassage(entry: Entry, voice: (typeof VOICES)[number]) {
  const prompt = [
    "You write short interpretive lenses for The Beautiful Archive.",
    "Return plain prose only. No title, no quotation marks, no bullet points.",
    "Maximum 60 words.",
    voiceBrief(voice),
    "",
    `Title: ${entry.title}`,
    `Creator: ${entry.creator}`,
    `Year: ${entry.year ?? "unknown"}`,
    `Country: ${entry.country}`,
    `Subject: ${entry.subjectName}`,
    `Logline: ${entry.logline}`,
    `Why it matters: ${entry.whyItMatters}`,
  ].join("\n");

  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Ollama ${response.status} ${response.statusText} for ${entry.id}/${voice}`,
    );
  }

  const payload = (await response.json()) as { response?: string };
  const text = String(payload.response || "")
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .trim();

  if (!text) {
    throw new Error(`Empty Ollama response for ${entry.id}/${voice}`);
  }
  if (wordCount(text) > 60) {
    console.warn(
      `[generate-lenses] ${entry.id}/${voice}: ${wordCount(text)} words (over 60); kept for hand edit`,
    );
  }

  return text;
}

async function main() {
  if (!fs.existsSync(ENTRIES_PATH)) {
    console.error(`Missing ${ENTRIES_PATH}`);
    process.exit(1);
  }
  if (!fs.existsSync(LENSES_PATH)) {
    console.error(`Missing ${LENSES_PATH}`);
    process.exit(1);
  }

  const entries = loadJson<Entry[]>(ENTRIES_PATH);
  const existing = loadJson<LensRecord[]>(LENSES_PATH);
  const already = new Set(existing.map((record) => record.entryId));

  const targets = entries.filter((entry) => entry?.id && !already.has(entry.id));
  console.log(
    `[generate-lenses] published=${entries.length} already=${already.size} toGenerate=${targets.length}`,
  );
  console.log(
    "[generate-lenses] Draft output only. Edit by hand before promoting to lenses.json.",
  );

  if (targets.length === 0) {
    fs.writeFileSync(DRAFT_PATH, `${JSON.stringify([], null, 2)}\n`);
    console.log(`[generate-lenses] wrote empty draft ${DRAFT_PATH}`);
    return;
  }

  const draft: LensRecord[] = [];

  for (const entry of targets) {
    console.log(`[generate-lenses] ${entry.id}`);
    const lenses: LensPassage[] = [];
    for (const voice of VOICES) {
      const text = await generatePassage(entry, voice);
      lenses.push({ voice, text });
    }
    draft.push({ entryId: entry.id, lenses });
  }

  fs.writeFileSync(DRAFT_PATH, `${JSON.stringify(draft, null, 2)}\n`);
  console.log(`[generate-lenses] wrote ${draft.length} record(s) to ${DRAFT_PATH}`);
}

main().catch((error) => {
  console.error("[generate-lenses] failed:", error);
  process.exit(1);
});
