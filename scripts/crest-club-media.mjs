/**
 * Club media for the Crest league reveal: Sportmonks id, badge, and two colours per club.
 *
 *   node scripts/crest-club-media.mjs                  # all clubs, writes the JSON files
 *   node scripts/crest-club-media.mjs --dry-run        # no writes
 *   node scripts/crest-club-media.mjs --slug=arsenal   # one club
 *   node scripts/crest-club-media.mjs --limit=10       # first ten clubs
 *   node scripts/crest-club-media.mjs --refresh        # redo clubs already in the file
 *
 * Needs SPORTMONKS_API_KEY (bare token) in the environment or .env.local. The token is
 * sent in the Authorization header and never printed. Needs `sharp` (ships with Next)
 * only when a club has to get its colours from the badge image.
 *
 * Output:
 *   lib/crest/club-media.json            keyed by club slug
 *   lib/crest/club-media-unmatched.json  clubs it could not match, with the reason
 * A club is matched only when one Sportmonks team is a clear winner. Nothing is guessed.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CLUBS } from "../lib/crest/clubs.js";
import {
  dominantColours,
  pickTeam,
  searchQueries,
  sportmonksColours,
} from "../lib/crest/media-match.js";
import { SPORTMONKS_BASE, sportmonksApiKey } from "./crest/sportmonks-env.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MEDIA_PATH = join(ROOT, "lib/crest/club-media.json");
const UNMATCHED_PATH = join(ROOT, "lib/crest/club-media-unmatched.json");

function loadEnvLocal() {
  const path = join(ROOT, ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (/^(".*"|'.*')$/.test(val)) val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
  }
}

function parseArgs(argv) {
  const args = { dryRun: false, slug: null, limit: null, refresh: false };
  for (const arg of argv.slice(2)) {
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--refresh") args.refresh = true;
    else if (arg.startsWith("--slug=")) args.slug = arg.slice(7);
    else if (arg.startsWith("--limit=")) args.limit = Number(arg.slice(8));
  }
  return args;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** GET with the token in a header. Errors name the path only, never the URL or token. */
async function smGet(path, params = {}) {
  const token = sportmonksApiKey();
  const url = new URL(`${SPORTMONKS_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const res = await fetch(url, { headers: { Accept: "application/json", Authorization: token } });
    if (res.status === 429) {
      await sleep(2000 * (attempt + 1));
      continue;
    }
    if (res.status === 401 || res.status === 403 || res.status === 402) {
      throw new Error(`Sportmonks refused ${path} (${res.status}). Check the token and plan.`);
    }
    if (!res.ok) throw new Error(`Sportmonks ${path} returned ${res.status}`);
    return res.json();
  }
  throw new Error(`Sportmonks ${path} rate limited`);
}

async function findTeam(club) {
  let lastReason = "no candidates";
  for (const query of searchQueries(club)) {
    const body = await smGet(`/teams/search/${encodeURIComponent(query)}`, { include: "country" });
    const picked = pickTeam(club, body.data ?? []);
    if (picked.team) return picked;
    lastReason = picked.reason;
  }
  return { team: null, reason: lastReason };
}

async function coloursFromBadge(imageUrl) {
  let sharp;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    throw new Error("sharp is not installed; run npm install to get it back");
  }
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`badge download returned ${res.status}`);
  const { data } = await sharp(Buffer.from(await res.arrayBuffer()))
    .resize(64, 64, { fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return dominantColours(data);
}

async function main() {
  loadEnvLocal();
  const args = parseArgs(process.argv);
  if (!sportmonksApiKey()) {
    console.error("SPORTMONKS_API_KEY is not set. Put the bare token in .env.local or the environment.");
    process.exit(1);
  }

  const existing = existsSync(MEDIA_PATH) ? JSON.parse(readFileSync(MEDIA_PATH, "utf8")) : {};
  const media = { ...existing };
  const unmatched = [];

  let clubs = args.slug ? CLUBS.filter((c) => c.slug === args.slug) : CLUBS;
  if (args.slug && !clubs.length) {
    console.error(`No club with slug ${args.slug}`);
    process.exit(1);
  }
  if (args.limit) clubs = clubs.slice(0, args.limit);

  let done = 0;
  for (const club of clubs) {
    done += 1;
    if (media[club.slug] && !args.refresh) continue;
    try {
      const { team, reason } = await findTeam(club);
      if (!team) {
        unmatched.push({ slug: club.slug, name: club.name, reason });
        console.log(`[${done}/${clubs.length}] UNMATCHED ${club.slug}: ${reason}`);
        continue;
      }
      let colours = sportmonksColours(team);
      let colourSource = "sportmonks";
      if (!colours) {
        colours = await coloursFromBadge(team.image_path);
        colourSource = "badge";
      }
      if (!colours) {
        unmatched.push({ slug: club.slug, name: club.name, reason: "badge has no usable colour" });
        console.log(`[${done}/${clubs.length}] UNMATCHED ${club.slug}: badge has no usable colour`);
        continue;
      }
      media[club.slug] = {
        sportmonks_id: team.id,
        badge_url: team.image_path,
        primary: colours.primary,
        secondary: colours.secondary,
        colour_source: colourSource,
        matched_name: team.name,
      };
      console.log(`[${done}/${clubs.length}] ${club.slug} -> ${team.name} (${colourSource})`);
    } catch (err) {
      if (/refused|rate limited/.test(err.message)) throw err;
      unmatched.push({ slug: club.slug, name: club.name, reason: `error: ${err.message}` });
      console.log(`[${done}/${clubs.length}] UNMATCHED ${club.slug}: ${err.message}`);
    }
    await sleep(150);
  }

  // Keep the file stable: sorted by slug, so reruns diff cleanly.
  const sorted = Object.fromEntries(Object.entries(media).sort(([a], [b]) => a.localeCompare(b)));
  console.log(`\nMatched ${Object.keys(sorted).length} of ${CLUBS.length}. Unmatched this run: ${unmatched.length}.`);
  for (const u of unmatched) console.log(`  ${u.slug}  ${u.reason}`);

  if (args.dryRun) {
    console.log("\nDry run: nothing written.");
    return;
  }
  writeFileSync(MEDIA_PATH, JSON.stringify(sorted, null, 2) + "\n");
  // Whole-run unmatched list = every club still missing from the media file.
  const stillMissing = CLUBS.filter((c) => !sorted[c.slug]).map((c) => {
    const hit = unmatched.find((u) => u.slug === c.slug);
    return { slug: c.slug, name: c.name, reason: hit?.reason ?? "not attempted in this run" };
  });
  writeFileSync(UNMATCHED_PATH, JSON.stringify(stillMissing, null, 2) + "\n");
  console.log(`Wrote ${MEDIA_PATH}\nWrote ${UNMATCHED_PATH}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
