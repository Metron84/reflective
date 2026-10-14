/**
 * Club media for the Crest league reveal: Sportmonks id, badge, and two colours per club.
 *
 *   node scripts/crest-club-media.mjs --refresh        # redo every club (use after a rework)
 *   node scripts/crest-club-media.mjs                  # only clubs not yet in the JSON
 *   node scripts/crest-club-media.mjs --overrides-only # apply club-media-overrides.json only; no token, no network
 *   node scripts/crest-club-media.mjs --dry-run        # no writes
 *   node scripts/crest-club-media.mjs --slug=psg       # one club
 *   node scripts/crest-club-media.mjs --limit=10       # first ten clubs
 *
 * Needs SPORTMONKS_API_KEY (bare token) in the environment or .env.local. The token goes
 * in the Authorization header and is never printed; errors name the path, never the URL.
 * Needs `sharp` (ships with Next) when a club has to take its colours from the badge.
 *
 * How a club is matched, in order:
 *   1. League first. For every Crest competition Sportmonks covers, fetch all teams of the
 *      current season and match club slugs locally (accents, FC/AC/SSC/CF affixes and known
 *      aliases normalised). League IDs: the Ultima env vars (SPORTMONKS_LEAGUE_ID_PL, _LALIGA,
 *      _SERIEA, _BUNDESLIGA, _LIGUE1), then every other competition discovered from /leagues,
 *      so Championship and the second tiers are used when the plan returns them.
 *   2. Fallback. /teams/search with common_name, then name, only for clubs still unmatched.
 *   3. Overrides. lib/crest/club-media-overrides.json is applied last and wins. An entry is
 *      sportmonks_id and/or badge_url (optional colours), or colours only: primary plus
 *      optional secondary gives the club its colours with no badge. Colour-only entries
 *      need no Sportmonks call, so --overrides-only runs without a token.
 * A club is matched only when one team is a clear winner. Nothing is guessed.
 *
 * Output:
 *   lib/crest/club-media.json            keyed by club slug
 *   lib/crest/club-media-unmatched.json  every club still missing, with category and reason:
 *                                        league_outside_plan, league_empty_season, not_found,
 *                                        no_competition, or an override error
 * With --refresh, a club the new run cannot match keeps its previous entry.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CLUBS } from "../lib/crest/clubs.js";
import {
  dominantColours,
  isColourOnly,
  matchLeagueClubs,
  parseOverride,
  pickTeam,
  resolveLeagues,
  searchQueries,
  sportmonksColours,
  unmatchedCategory,
} from "../lib/crest/media-match.js";
import { SPORTMONKS_BASE, sportmonksApiKey } from "./crest/sportmonks-env.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MEDIA_PATH = join(ROOT, "lib/crest/club-media.json");
const UNMATCHED_PATH = join(ROOT, "lib/crest/club-media-unmatched.json");
const OVERRIDES_PATH = join(ROOT, "lib/crest/club-media-overrides.json");
const MAX_PAGES = 40;

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
  const args = { dryRun: false, slug: null, limit: null, refresh: false, overridesOnly: false };
  for (const arg of argv.slice(2)) {
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--refresh") args.refresh = true;
    else if (arg === "--overrides-only") args.overridesOnly = true;
    else if (arg.startsWith("--slug=")) args.slug = arg.slice(7);
    else if (arg.startsWith("--limit=")) args.limit = Number(arg.slice(8));
  }
  return args;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** GET with the token in a header. Errors carry a status and name the path only. */
async function smGet(path, params = {}) {
  const url = new URL(`${SPORTMONKS_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const res = await fetch(url, {
      headers: { Accept: "application/json", Authorization: sportmonksApiKey() },
    });
    if (res.status === 429) {
      await sleep(2000 * (attempt + 1));
      continue;
    }
    if (!res.ok) {
      const err = new Error(`Sportmonks ${path} returned ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }
  const err = new Error(`Sportmonks ${path} rate limited`);
  err.status = 429;
  throw err;
}

/** 401 means the token itself is bad, so there is no point carrying on. */
function rethrowIfBadToken(err) {
  if (err.status === 401) {
    throw new Error("Sportmonks rejected the token (401). Check SPORTMONKS_API_KEY.");
  }
}

async function smPages(path, params = {}) {
  const rows = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const body = await smGet(path, page > 1 ? { ...params, page } : params);
    rows.push(...(body.data ?? []));
    if (!body.pagination?.has_more) break;
  }
  return rows;
}

/** State of one league: ok (with teams), outside_plan, empty_season or unresolved. */
async function loadLeague(competition, league) {
  if (!league) return { status: "unresolved", teams: [] };
  try {
    const res = await smGet(`/leagues/${league.id}`, { include: "currentSeason" });
    const seasonId =
      res?.data?.currentseason?.id ?? res?.data?.currentSeason?.id ?? res?.data?.current_season_id;
    if (!seasonId) return { status: "empty_season", teams: [], league };
    const teams = await smPages(`/teams/seasons/${seasonId}`);
    if (!teams.length) return { status: "empty_season", teams: [], league, seasonId };
    return { status: "ok", teams, league, seasonId };
  } catch (err) {
    rethrowIfBadToken(err);
    if (err.status === 403) return { status: "outside_plan", teams: [], league };
    throw err;
  }
}

async function searchFallback(club) {
  let lastReason = "no candidates";
  for (const query of searchQueries(club)) {
    let body;
    try {
      body = await smGet(`/teams/search/${encodeURIComponent(query)}`, { include: "country" });
    } catch (err) {
      rethrowIfBadToken(err);
      if (err.status === 403) return { team: null, reason: "search is outside the plan (403)" };
      throw err;
    }
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

async function entryFromTeam(team, matchSource) {
  let colours = sportmonksColours(team);
  let colourSource = "sportmonks";
  if (!colours) {
    colours = await coloursFromBadge(team.image_path);
    colourSource = "badge";
  }
  if (!colours) return { error: "badge has no usable colour" };
  return {
    entry: {
      sportmonks_id: team.id,
      badge_url: team.image_path,
      primary: colours.primary,
      secondary: colours.secondary,
      colour_source: colourSource,
      match_source: matchSource,
      matched_name: team.name,
    },
  };
}

function readJson(path, fallback) {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : fallback;
}

/**
 * Manual overrides, applied last. Colour-only entries never touch the network. Entries that
 * need a Sportmonks lookup or badge colours are refused when `offline` is set.
 * Returns { applied: n, errors: [{slug, reason}] }.
 */
async function applyOverrides(media, teamById, { offline = false } = {}) {
  const overrides = readJson(OVERRIDES_PATH, {});
  const errors = [];
  let applied = 0;
  const needsNetwork = "needs Sportmonks (id lookup or badge colours); rerun without --overrides-only";
  for (const [slug, raw] of Object.entries(overrides)) {
    if (!CLUBS.some((c) => c.slug === slug)) {
      errors.push({ slug, reason: "override names a slug that is not in CLUBS" });
      continue;
    }
    const parsed = parseOverride(raw);
    if (parsed.error) {
      errors.push({ slug, reason: `override: ${parsed.error}` });
      continue;
    }
    const o = parsed.value;
    const base = media[slug] ?? {};

    if (isColourOnly(o)) {
      // Colours only. An existing badge is kept; a club with none stays badge-less.
      media[slug] = {
        sportmonks_id: base.sportmonks_id ?? null,
        badge_url: base.badge_url ?? null,
        primary: o.primary,
        secondary: o.secondary ?? null,
        colour_source: "override",
        match_source: "override",
        matched_name: base.matched_name ?? "manual override",
      };
      applied += 1;
      continue;
    }

    try {
      let team = null;
      if (o.sportmonks_id) {
        team = teamById.get(o.sportmonks_id) ?? null;
        if (!team) {
          if (offline) {
            errors.push({ slug, reason: `override: ${needsNetwork}` });
            continue;
          }
          team = (await smGet(`/teams/${o.sportmonks_id}`)).data ?? null;
        }
      }
      const badge = o.badge_url ?? team?.image_path ?? base.badge_url ?? null;
      if (!badge) {
        errors.push({ slug, reason: "override has no badge: give badge_url or a sportmonks_id with an image" });
        continue;
      }
      let primary = o.primary;
      let secondary = o.secondary ?? null;
      let colourSource = "override";
      if (!primary) {
        const keep = base.badge_url === badge && base.primary;
        if (!keep && offline) {
          errors.push({ slug, reason: `override: ${needsNetwork}` });
          continue;
        }
        const found = keep ? { primary: base.primary, secondary: base.secondary } : await coloursFromBadge(badge);
        if (!found) {
          errors.push({ slug, reason: "override badge has no usable colour; give primary" });
          continue;
        }
        primary = found.primary;
        secondary = o.secondary ?? found.secondary;
        colourSource = keep ? base.colour_source : "badge";
      }
      media[slug] = {
        sportmonks_id: o.sportmonks_id ?? base.sportmonks_id ?? null,
        badge_url: badge,
        primary,
        secondary,
        colour_source: colourSource,
        match_source: "override",
        matched_name: team?.name ?? base.matched_name ?? "manual override",
      };
      applied += 1;
    } catch (err) {
      rethrowIfBadToken(err);
      errors.push({ slug, reason: `override: ${err.message}` });
    }
  }
  return { applied, errors };
}

/** Overrides only: no token, no network. Unmatched keeps its earlier categories. */
async function runOverridesOnly(args) {
  const media = readJson(MEDIA_PATH, {});
  const overrides = await applyOverrides(media, new Map(), { offline: true });
  const sorted = Object.fromEntries(Object.entries(media).sort(([a], [b]) => a.localeCompare(b)));
  const previous = readJson(UNMATCHED_PATH, []);
  const unmatched = [];
  for (const club of CLUBS) {
    if (sorted[club.slug]) continue;
    const before = previous.find((u) => u.slug === club.slug);
    const err = overrides.errors.find((e) => e.slug === club.slug);
    unmatched.push({
      slug: club.slug,
      name: club.name,
      competition: club.competition ?? null,
      category: before?.category ?? "not_attempted",
      reason: [before?.reason ?? "no earlier run recorded this club", err?.reason].filter(Boolean).join("; "),
    });
  }
  const bySource = {};
  for (const e of Object.values(sorted)) bySource[e.match_source ?? "previous run"] = (bySource[e.match_source ?? "previous run"] ?? 0) + 1;
  console.log(`Overrides applied: ${overrides.applied}. Errors: ${overrides.errors.length}.`);
  for (const e of overrides.errors) console.log(`  override error ${e.slug}: ${e.reason}`);
  console.log(`Matched ${Object.keys(sorted).length} of ${CLUBS.length}. Sources: ${JSON.stringify(bySource)}.`);
  const byCategory = {};
  for (const u of unmatched) byCategory[u.category] = [...(byCategory[u.category] ?? []), u];
  for (const [category, list] of Object.entries(byCategory)) {
    console.log(`\n${category} (${list.length})`);
    for (const u of list) console.log(`  ${u.slug}  [${u.competition ?? "none"}]  ${u.reason}`);
  }
  if (args.dryRun) {
    console.log("\nDry run: nothing written.");
    return;
  }
  writeFileSync(MEDIA_PATH, JSON.stringify(sorted, null, 2) + "\n");
  writeFileSync(UNMATCHED_PATH, JSON.stringify(unmatched, null, 2) + "\n");
  console.log(`\nWrote ${MEDIA_PATH}\nWrote ${UNMATCHED_PATH}`);
}

async function main() {
  loadEnvLocal();
  const args = parseArgs(process.argv);
  if (args.overridesOnly) return runOverridesOnly(args);
  if (!sportmonksApiKey()) {
    console.error("SPORTMONKS_API_KEY is not set. Put the bare token in .env.local or the environment.");
    process.exit(1);
  }

  const existing = readJson(MEDIA_PATH, {});
  const media = { ...existing };

  let clubs = args.slug ? CLUBS.filter((c) => c.slug === args.slug) : CLUBS;
  if (args.slug && !clubs.length) {
    console.error(`No club with slug ${args.slug}`);
    process.exit(1);
  }
  if (args.limit) clubs = clubs.slice(0, args.limit);
  const todo = clubs.filter((c) => args.refresh || !media[c.slug]);

  // 1. League first.
  let leagueRows = [];
  try {
    leagueRows = await smPages("/leagues", { include: "country" });
  } catch (err) {
    rethrowIfBadToken(err);
    console.log(`League listing unavailable (${err.status ?? "error"}). Using the Ultima env league IDs only.`);
  }
  const resolved = resolveLeagues(leagueRows, process.env);
  const competitions = [...new Set(CLUBS.map((c) => c.competition).filter(Boolean))];
  const leagues = new Map();
  console.log("Leagues");
  for (const competition of competitions) {
    const state = await loadLeague(competition, resolved[competition]);
    leagues.set(competition, state);
    const id = resolved[competition] ? `id ${resolved[competition].id} (${resolved[competition].source})` : "no league id";
    const detail = state.status === "ok" ? `${state.teams.length} teams` : state.status;
    console.log(`  ${competition.padEnd(22)} ${id.padEnd(20)} ${detail}`);
    await sleep(100);
  }

  const teamById = new Map();
  for (const s of leagues.values()) for (const t of s.teams) teamById.set(t.id, t);

  const pending = new Map(); // slug -> reason it is still unmatched after the league pass
  const fresh = {};
  for (const [competition, state] of leagues) {
    const inLeague = todo.filter((c) => c.competition === competition);
    if (!inLeague.length || state.status !== "ok") continue;
    const matches = matchLeagueClubs(inLeague, state.teams);
    for (const club of inLeague) {
      const m = matches.get(club.slug);
      if (m?.team) fresh[club.slug] = { team: m.team, source: "league" };
      else pending.set(club.slug, m?.reason ?? "not found in league teams");
    }
  }

  // 2. Fallback search, only for clubs still unmatched.
  const fallbackReason = new Map();
  const needSearch = todo.filter((c) => !fresh[c.slug]);
  console.log(`\nLeague pass matched ${Object.keys(fresh).length} of ${todo.length}. Searching for ${needSearch.length}.`);
  for (const club of needSearch) {
    const { team, reason } = await searchFallback(club);
    if (team) fresh[club.slug] = { team, source: "search" };
    else fallbackReason.set(club.slug, reason);
    await sleep(150);
  }

  // Colours and entries.
  const failures = new Map();
  for (const club of todo) {
    const hit = fresh[club.slug];
    if (!hit) continue;
    try {
      const out = await entryFromTeam(hit.team, hit.source);
      if (out.entry) media[club.slug] = out.entry;
      else failures.set(club.slug, out.error);
    } catch (err) {
      failures.set(club.slug, err.message);
    }
  }

  // 3. Overrides, last.
  const overrides = await applyOverrides(media, teamById);

  // Report.
  const sorted = Object.fromEntries(Object.entries(media).sort(([a], [b]) => a.localeCompare(b)));
  const bySource = {};
  for (const e of Object.values(sorted)) bySource[e.match_source ?? "previous run"] = (bySource[e.match_source ?? "previous run"] ?? 0) + 1;
  const unmatched = [];
  for (const club of CLUBS) {
    if (sorted[club.slug]) continue;
    const override = overrides.errors.find((e) => e.slug === club.slug);
    const detail = failures.get(club.slug) ?? `search: ${fallbackReason.get(club.slug) ?? "not attempted"}`;
    const base = unmatchedCategory(club, leagues.get(club.competition), detail);
    const reason = [base.reason, pending.get(club.slug) && `league: ${pending.get(club.slug)}`, override?.reason]
      .filter(Boolean)
      .join("; ");
    unmatched.push({ slug: club.slug, name: club.name, competition: club.competition ?? null, category: base.category, reason });
  }
  for (const e of overrides.errors) {
    if (!unmatched.some((u) => u.slug === e.slug)) console.log(`  override error ${e.slug}: ${e.reason}`);
  }

  console.log(`\nMatched ${Object.keys(sorted).length} of ${CLUBS.length}. Sources: ${JSON.stringify(bySource)}. Overrides applied: ${overrides.applied}.`);
  const byCategory = {};
  for (const u of unmatched) byCategory[u.category] = [...(byCategory[u.category] ?? []), u];
  for (const [category, list] of Object.entries(byCategory)) {
    console.log(`\n${category} (${list.length})`);
    for (const u of list) console.log(`  ${u.slug}  [${u.competition ?? "none"}]  ${u.reason}`);
  }

  if (args.dryRun) {
    console.log("\nDry run: nothing written.");
    return;
  }
  writeFileSync(MEDIA_PATH, JSON.stringify(sorted, null, 2) + "\n");
  writeFileSync(UNMATCHED_PATH, JSON.stringify(unmatched, null, 2) + "\n");
  console.log(`\nWrote ${MEDIA_PATH}\nWrote ${UNMATCHED_PATH}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
