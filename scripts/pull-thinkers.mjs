#!/usr/bin/env node
/**
 * Pull the master thinkers database at build time. thinkers-apps holds the only copy;
 * this repo never commits it.
 *
 *   THINKERS_MASTER_TOKEN   required to fetch (set in Vercel env)
 *   THINKERS_MASTER_URL     default https://thinkers-apps.vercel.app/api/master
 *   THINKERS_BYPASS         optional Vercel protection bypass secret for that deployment
 *   THINKERS_FILE           optional local path to a thinkers.json, for offline dev
 *
 * Writes .thinkers/thinkers.json and .thinkers/methods.json (gitignored).
 * With no token and no local file it writes empty lists and exits 0, so the
 * build still passes and thinker features simply stay hidden.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), ".thinkers");
mkdirSync(OUT, { recursive: true });
const write = (name, data) => writeFileSync(join(OUT, name), JSON.stringify(data));

async function main() {
  const local = process.env.THINKERS_FILE;
  if (local && existsSync(local)) {
    write("thinkers.json", JSON.parse(readFileSync(local, "utf8")));
    if (!existsSync(join(OUT, "methods.json"))) write("methods.json", []);
    console.log(`[thinkers] using local file ${local}`);
    return;
  }
  const token = process.env.THINKERS_MASTER_TOKEN;
  if (!token) {
    if (!existsSync(join(OUT, "thinkers.json"))) write("thinkers.json", []);
    if (!existsSync(join(OUT, "methods.json"))) write("methods.json", []);
    console.warn("[thinkers] THINKERS_MASTER_TOKEN not set; thinker features stay hidden.");
    return;
  }
  const url = process.env.THINKERS_MASTER_URL || "https://thinkers-apps.vercel.app/api/master";
  const headers = { "x-master-token": token };
  if (process.env.THINKERS_BYPASS) headers["x-vercel-protection-bypass"] = process.env.THINKERS_BYPASS;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`[thinkers] master fetch failed: HTTP ${res.status}`);
  const body = await res.json();
  if (!Array.isArray(body.thinkers) || !body.thinkers.length) throw new Error("[thinkers] master returned no thinkers");
  write("thinkers.json", body.thinkers);
  write("methods.json", body.methods || []);
  console.log(`[thinkers] pulled ${body.thinkers.length} entries from master`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
