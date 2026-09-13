#!/usr/bin/env node
/**
 * Import Tier A + Tier B placeholders, then snapshot to crest-app.
 *
 *   node scripts/crest/import-all-clubs.mjs --commit
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { supabaseFromEnv } from "./crest-env.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const commit = process.argv.includes("--commit");
const args = commit ? ["--commit"] : [];

function hasSupabaseCreds() {
  try {
    supabaseFromEnv(ROOT);
    return true;
  } catch {
    return false;
  }
}

function run(script, runArgs = args) {
  const r = spawnSync(process.execPath, [script, ...runArgs], {
    cwd: ROOT,
    stdio: "inherit",
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const supabaseReady = hasSupabaseCreds();

if (commit && !supabaseReady) {
  console.warn(
    "No Supabase service role in .env.local. Skipping DB upsert; building clubs.json from repo data.",
  );
  run(join(ROOT, "scripts/crest/build-clubs-local.mjs"), []);
  const enrichOnly = join(ROOT, "../crest-app/scripts/enrich-club-ground.mjs");
  const er0 = spawnSync(process.execPath, [enrichOnly], {
    cwd: join(ROOT, "../crest-app"),
    stdio: "inherit",
  });
  process.exit(er0.status ?? 0);
}

run(join(ROOT, "scripts/crest/import-tier-a.mjs"), commit ? ["--commit"] : []);
run(
  join(ROOT, "scripts/crest/import-tier-b-placeholders.mjs"),
  commit ? ["--commit"] : [],
);

if (commit) {
  {
    const snap = spawnSync(
      process.execPath,
      [join(ROOT, "scripts/crest/snapshot.mjs")],
      { cwd: ROOT, stdio: "inherit" },
    );
    if (snap.status !== 0) {
      console.warn("\nSnapshot failed. Using local data build.");
      run(join(ROOT, "scripts/crest/build-clubs-local.mjs"), []);
    }
  }
  const enrich = join(ROOT, "../crest-app/scripts/enrich-club-ground.mjs");
  const er = spawnSync(process.execPath, [enrich], {
    cwd: join(ROOT, "../crest-app"),
    stdio: "inherit",
  });
  if (er.status !== 0) {
    console.log("\nEnrich failed. Run in crest-app: npm run enrich:ground");
    process.exit(er.status ?? 1);
  }
}
