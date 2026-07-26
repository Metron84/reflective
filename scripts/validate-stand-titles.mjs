#!/usr/bin/env node
/**
 * Validate data/stand/titles.json for The Stand Fan Card.
 * Run: node scripts/validate-stand-titles.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const STAND = path.join(ROOT, "data/stand");
const TITLES_PATH = path.join(STAND, "titles.json");
const CHAPTERS_DIR = path.join(STAND, "chapters");

const REQUIRED_SCOPES = ["club", "nation", "player"];

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function collectLiveTags() {
  const tags = new Set();
  const files = fs.readdirSync(CHAPTERS_DIR).filter((f) => f.endsWith(".json"));
  for (const f of files) {
    const chapter = loadJson(path.join(CHAPTERS_DIR, f));
    for (const q of chapter.questions || []) {
      for (const c of q.choices || []) {
        for (const t of c.tags || []) tags.add(t);
      }
    }
  }
  return tags;
}

function main() {
  const errors = [];
  if (!fs.existsSync(TITLES_PATH)) {
    console.error(`FAIL missing ${TITLES_PATH}`);
    process.exit(1);
  }

  const titles = loadJson(TITLES_PATH);
  if (!Array.isArray(titles) || titles.length === 0) {
    errors.push("titles.json must be a non-empty array");
  }

  const liveTags = collectLiveTags();
  const ids = new Set();
  const fallbackByScope = { club: 0, nation: 0, player: 0 };
  const countByScope = { club: 0, nation: 0, player: 0, any: 0 };

  for (const [i, title] of (titles || []).entries()) {
    const where = `titles[${i}]`;
    if (!title?.id || typeof title.id !== "string") {
      errors.push(`${where}: missing id`);
      continue;
    }
    if (ids.has(title.id)) {
      errors.push(`${where}: duplicate id "${title.id}"`);
    }
    ids.add(title.id);

    if (!title.label || typeof title.label !== "string") {
      errors.push(`${where} (${title.id}): missing label`);
    } else if (/[—–]/.test(title.label)) {
      errors.push(`${where} (${title.id}): label contains em/en dash`);
    }

    if (!REQUIRED_SCOPES.includes(title.badge_scope) && title.badge_scope !== "any") {
      errors.push(
        `${where} (${title.id}): badge_scope must be club|nation|player|any`,
      );
    } else {
      countByScope[title.badge_scope] =
        (countByScope[title.badge_scope] || 0) + 1;
    }

    if (!Array.isArray(title.tags)) {
      errors.push(`${where} (${title.id}): tags must be an array`);
    } else if (!title.fallback) {
      if (title.tags.length === 0) {
        errors.push(`${where} (${title.id}): non-fallback title needs tags`);
      }
      for (const tag of title.tags) {
        if (!liveTags.has(tag)) {
          errors.push(
            `${where} (${title.id}): tag "${tag}" not found in any chapter`,
          );
        }
      }
    } else {
      for (const tag of title.tags || []) {
        if (tag && !liveTags.has(tag)) {
          errors.push(
            `${where} (${title.id}): fallback tag "${tag}" not found in any chapter`,
          );
        }
      }
    }

    if (title.fallback && REQUIRED_SCOPES.includes(title.badge_scope)) {
      fallbackByScope[title.badge_scope] += 1;
    }
  }

  for (const scope of REQUIRED_SCOPES) {
    if (fallbackByScope[scope] < 1) {
      errors.push(`missing fallback title for badge_scope "${scope}"`);
    }
  }

  if (errors.length) {
    console.error("FAIL titles.json");
    for (const e of errors) console.error(" -", e);
    process.exit(1);
  }

  console.log(
    `OK titles.json · ${titles.length} titles · scopes club=${countByScope.club} nation=${countByScope.nation} player=${countByScope.player} · fallbacks ok`,
  );
}

main();
