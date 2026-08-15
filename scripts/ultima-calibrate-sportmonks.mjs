/**
 * Compare mock Appendix A sample stats against Sportmonks fixture data.
 * Run: node scripts/ultima-calibrate-sportmonks.mjs [--league pl] [--from YYYY-MM-DD] [--to YYYY-MM-DD]
 *
 * Requires SPORTMONKS_API_KEY and league ID env vars. Read-only; prints a report.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { SportmonksProvider } from "../lib/ultima/provider/sportmonks.js";
import { getSportmonksLeagueId, statTypeIds } from "../lib/ultima/provider/sportmonks-config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sample = JSON.parse(
  readFileSync(join(__dirname, "../data/ultima/seed/stats.gw-sample.json"), "utf8"),
);

function parseArgs(argv) {
  const args = { league: "pl", from: sample.window_start.slice(0, 10), to: sample.window_end.slice(0, 10) };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--league") args.league = argv[++i];
    if (argv[i] === "--from") args.from = argv[++i];
    if (argv[i] === "--to") args.to = argv[++i];
  }
  return args;
}

function summariseStats(rows) {
  const goals = rows.reduce((s, r) => s + (r.goals ?? 0), 0);
  const assists = rows.reduce((s, r) => s + (r.assists ?? 0), 0);
  const ratings = rows.map((r) => r.rating).filter((r) => r != null);
  const avgRating = ratings.length
    ? ratings.reduce((a, b) => a + b, 0) / ratings.length
    : null;
  return { players: rows.length, goals, assists, avgRating };
}

async function main() {
  if (!process.env.SPORTMONKS_API_KEY?.trim()) {
    console.error("SPORTMONKS_API_KEY not set.");
    process.exit(1);
  }

  const args = parseArgs(process.argv);
  const leagueId = getSportmonksLeagueId(args.league);
  if (!leagueId) {
    console.error(`No league ID for ${args.league}. Set SPORTMONKS_LEAGUE_ID_* env var.`);
    process.exit(1);
  }

  const provider = new SportmonksProvider();
  const fixtures = await provider.fetchFixtures(args.league, args.from, args.to);

  console.log(`\nUltima Sportmonks calibration report`);
  console.log(`League: ${args.league} (ID ${leagueId})`);
  console.log(`Window: ${args.from} → ${args.to}`);
  console.log(`Stat type IDs: ${JSON.stringify(statTypeIds())}`);
  console.log(`Fixtures returned: ${fixtures.length}\n`);

  const mockFixtures = (sample.fixtures ?? []).filter((f) => f.league === args.league);
  console.log(`Mock sample fixtures for ${args.league}: ${mockFixtures.length}`);
  for (const fix of mockFixtures) {
    const mockSummary = summariseStats(fix.players ?? []);
    console.log(`  ${fix.provider_id}: ${JSON.stringify(mockSummary)}`);
  }

  if (fixtures.length) {
    console.log(`\nLive Sportmonks fixtures (first 5):`);
    for (const fix of fixtures.slice(0, 5)) {
      const smId = fix.sportmonks_fixture_id;
      const stats = smId ? await provider.fetchPlayerMatchStats(smId) : [];
      const liveSummary = summariseStats(stats);
      console.log(
        `  ${fix.provider_id} @ ${fix.kickoff} [${fix.status}]: ${JSON.stringify(liveSummary)}`,
      );
    }
  }

  console.log(`\nNext steps:`);
  console.log(`1. Confirm stat type IDs match your Sportmonks plan.`);
  console.log(`2. Tune ultima_competition.rating_thresholds per league if rating scales differ.`);
  console.log(`3. Bootstrap or create a gameweek, then run commissioner Sync fixtures/stats.`);
  console.log(`4. Compare recomputeGameweekScores output to mock Appendix A (v5 total: 41).\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
