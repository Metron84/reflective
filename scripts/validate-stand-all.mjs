#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function run(script, args = []) {
  const r = spawnSync(process.execPath, [path.join(__dirname, script), ...args], {
    encoding: "utf8",
  });
  process.stdout.write(r.stdout || "");
  process.stderr.write(r.stderr || "");
  return r.status ?? 1;
}

let failed = 0;

const titlesStatus = run("validate-stand-titles.mjs");
if (titlesStatus !== 0) failed += 1;

const dir = path.join(ROOT, "data/stand/chapters");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
for (const f of files) {
  const status = run("validate-stand-chapter.mjs", [path.join(dir, f)]);
  if (status !== 0) failed += 1;
}

if (failed) {
  console.error(`\nvalidate:stand-all failed (${failed} step(s))`);
  process.exit(1);
}
console.log(`\nAll ${files.length} chapters OK · titles OK`);
