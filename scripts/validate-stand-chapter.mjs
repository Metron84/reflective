#!/usr/bin/env node
/**
 * Validate The Stand chapter JSON against entity indexes.
 * Run: node scripts/validate-stand-chapter.mjs [path]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const STAND = path.join(ROOT, "data/stand");

const chapterPath =
  process.argv[2] ||
  path.join(STAND, "chapters/sa.fiorentina.ch01.json");

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function main() {
  const clubs = new Set(loadJson(path.join(STAND, "clubs.json")).map((c) => c.id));
  const nations = new Set(loadJson(path.join(STAND, "nations.json")).map((n) => n.id));
  const seed = loadJson(path.join(ROOT, "data/players_seed.json"));
  const persons = new Set(seed.players.map((p) => p.person_id));
  const chapter = loadJson(chapterPath);
  const errors = [];

  if (chapter.questions?.length !== 15) {
    errors.push(`Expected 15 questions, got ${chapter.questions?.length}`);
  }
  if (chapter.questions_per_day !== 5) {
    errors.push("questions_per_day must be 5");
  }

  const checkEntity = (ref, where) => {
    if (!ref?.type || !ref?.id) {
      errors.push(`${where}: missing type/id`);
      return;
    }
    if (ref.type === "club" && !clubs.has(ref.id)) {
      errors.push(`${where}: unknown club ${ref.id}`);
    }
    if (ref.type === "nation" && !nations.has(ref.id)) {
      errors.push(`${where}: unknown nation ${ref.id}`);
    }
    if (ref.type === "person" && !persons.has(ref.id)) {
      errors.push(`${where}: unknown person ${ref.id}`);
    }
  };

  checkEntity(chapter.primary_entity, "primary_entity");
  for (const [i, e] of (chapter.secondary_entities || []).entries()) {
    checkEntity(e, `secondary_entities[${i}]`);
  }

  const emDash = /—|–/;
  for (const q of chapter.questions || []) {
    const blob = [q.scene, q.prompt, q.cliffhanger, ...(q.choices || []).map((c) => c.label)]
      .filter(Boolean)
      .join(" ");
    if (emDash.test(blob)) {
      errors.push(`Q${q.order}: contains em/en dash (forbidden)`);
    }
    if (q.choices?.length !== 3) {
      errors.push(`Q${q.order}: need 3 choices`);
    }
    for (const [i, e] of (q.entity_refs || []).entries()) {
      checkEntity(e, `Q${q.order}.entity_refs[${i}]`);
    }
    const expectedDay = Math.ceil(q.order / 5);
    if (q.day !== expectedDay) {
      errors.push(`Q${q.order}: day should be ${expectedDay}, got ${q.day}`);
    }
  }

  if (!chapter.day_wall?.headline || !chapter.signup?.cta_primary) {
    errors.push("day_wall and signup copy required");
  }

  if (errors.length) {
    console.error(`FAIL ${chapterPath}`);
    for (const e of errors) console.error(" -", e);
    process.exit(1);
  }
  console.log(`OK ${chapter.id} (${chapter.status}) · 15 questions · entities resolve`);
}

main();
