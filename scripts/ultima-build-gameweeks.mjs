/**
 * Builds the 2026/27 Ultima gameweeks from Sportmonks fixtures.
 * Dry run by default. Writes only with --apply.
 *
 *   node --import ./tests/ultima/helpers/register.mjs --env-file=.env.local \
 *     scripts/ultima-build-gameweeks.mjs [--apply] [--competition <uuid>] [--first-friday 2026-10-09]
 *     scripts/ultima-build-gameweeks.mjs --refresh [--apply] [--competition <uuid>]
 *
 * --refresh updates league_open_at only, for 'upcoming' gameweeks starting within 14 days.
 * It never changes number or windows and never touches a league whose league_open_at is
 * already in the past. Dry run unless --apply is also given.
 *
 * Needs SPORTMONKS_API_KEY and the SPORTMONKS_LEAGUE_ID_* vars. --apply also needs
 * NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Secrets are never printed.
 * Fixtures are never invented: an empty league stops the run.
 */
import { createClient } from "@supabase/supabase-js";
import { buildGameweeks, toGstIso } from "../lib/ultima/gameweek-builder.js";
import { addDays, leagueIdsFromEnv, makeSportmonks } from "../lib/ultima/sportmonks-fixtures.js";
import { runOpenAtRefresh } from "../lib/ultima/server/open-at-refresh.js";

const SEASON_END = "2027-07-31";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const APPLY = flag("--apply");
const REFRESH = flag("--refresh");
const COMPETITION_ID = option("--competition", "3db872dc-8658-4839-be3e-f149fd13276c");
const FIRST_FRIDAY = option("--first-friday", "2026-10-09");

const key = process.env.SPORTMONKS_API_KEY?.trim();
if (!key) {
  console.error("SPORTMONKS_API_KEY is not set in this process. Nothing was fetched or written.");
  process.exit(1);
}

const sm = makeSportmonks(key);
const LEAGUES = leagueIdsFromEnv();

if (REFRESH) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("--refresh needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (reads gameweeks).");
    process.exit(1);
  }
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const report = await runOpenAtRefresh({ db, key, competitionId: COMPETITION_ID, apply: APPLY });
  console.log(
    `\nCandidates (upcoming, starting within 14 days): ${report.candidates.length ? report.candidates.map((n) => `GW${n}`).join(", ") : "none"}`,
  );
  console.log(`Changes: ${report.changes.length}. Locked leagues left alone: ${report.skippedPast.length}.`);
  for (const e of report.errors) console.error(`Error${e.league ? ` (${e.league})` : ""}: ${e.message}`);
  console.log(APPLY ? `Applied to ${report.applied} gameweek(s).` : "DRY RUN. Nothing written. Re-run with --refresh --apply to write.");
  process.exit(report.errors.length ? 4 : 0);
}

const gst = (iso) => toGstIso(new Date(iso)).replace("T", " ").slice(0, 16);

const fixtures = [];
const seasons = {};
for (const [league, leagueId] of Object.entries(LEAGUES)) {
  const seasonId = await sm.seasonIdFor(leagueId);
  if (!seasonId) {
    console.error(`STOP: no 2026/27 season found for ${league} (league ${leagueId}).`);
    process.exit(2);
  }
  const rows = await sm.fetchLeagueFixtures({
    league,
    leagueId,
    seasonId,
    from: addDays(FIRST_FRIDAY, -1),
    to: SEASON_END,
  });
  if (!rows.length) {
    console.error(`STOP: Sportmonks returned no 2026/27 fixtures for ${league} (season ${seasonId}).`);
    process.exit(2);
  }
  seasons[league] = seasonId;
  fixtures.push(...rows);
  console.log(`${league}: season ${seasonId}, ${rows.length} fixtures from ${FIRST_FRIDAY}`);
}

const odd = fixtures.filter((f) => !/^(NS|FT|INPLAY|LIVE|HT|AET|PEN|TBA)/i.test(String(f.state ?? "NS")));
if (odd.length) {
  const tally = {};
  for (const f of odd) tally[f.state] = (tally[f.state] ?? 0) + 1;
  console.log("Fixtures in unusual states (still counted):", JSON.stringify(tally));
}

const { gameweeks, skipped } = buildGameweeks(fixtures, { firstFriday: FIRST_FRIDAY });
console.log(`\nGameweeks to create: ${gameweeks.length}`);
console.log("\nnumber | window (Dubai) | fixtures per league | league_open_at");
for (const gw of [...gameweeks.slice(0, 6), ...(gameweeks.length > 9 ? ["…"] : []), ...gameweeks.slice(-3)]) {
  if (gw === "…") {
    console.log("…");
    continue;
  }
  console.log(
    `${gw.number} | ${gst(gw.window_start)} to ${gst(gw.window_end)} | ${JSON.stringify(gw.fixture_counts)} | ${JSON.stringify(gw.league_open_at)}`,
  );
}
console.log(`\nSkipped windows (no fixtures in any league): ${skipped.length}`);
for (const s of skipped) console.log(`  ${gst(s.windowStart.toISOString())} to ${gst(s.windowEnd.toISOString())}`);

if (!APPLY) {
  console.log("\nDRY RUN. Nothing written. Re-run with --apply to insert.");
  process.exit(0);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("--apply needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

const { data: comp } = await db
  .from("ultima_competition")
  .select("id, season_label")
  .eq("id", COMPETITION_ID)
  .maybeSingle();
if (!comp || comp.season_label !== "2026/27") {
  console.error("STOP: competition not found or not labelled 2026/27.");
  process.exit(3);
}
const { count } = await db
  .from("ultima_gameweeks")
  .select("id", { count: "exact", head: true })
  .eq("competition_id", COMPETITION_ID);
if (count) {
  console.error(`STOP: ${count} gameweek row(s) already exist for this competition. Remove the stale GW12 first.`);
  process.exit(3);
}

const rows = gameweeks.map((gw) => ({
  competition_id: COMPETITION_ID,
  number: gw.number,
  window_start: gw.window_start,
  window_end: gw.window_end,
  league_open_at: gw.league_open_at,
  state: "upcoming",
}));
const { error } = await db.from("ultima_gameweeks").insert(rows);
if (error) {
  console.error("Insert failed:", error.message);
  process.exit(4);
}
console.log(`\nInserted ${rows.length} gameweeks.`);
