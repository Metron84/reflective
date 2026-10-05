import { ULTIMA_LEAGUES } from "@/lib/ultima/constants";
import { countByGameweek, gameweekForKickoff, kickoffMs } from "@/lib/ultima/fixture-mapping";
import { applyOpenAtRefresh, planOpenAtRefresh, refreshCandidates } from "@/lib/ultima/gameweek-refresh";
import { fetchWindowFixtures, upsertFixturePacks } from "@/lib/ultima/server/sync";

/**
 * Compare counts to an expected table keyed by gameweek number, e.g. {1: {pl: 10, ...}}.
 * A chosen gameweek with no expected entry counts as a mismatch.
 */
export function compareExpected(counts, expected, numbers) {
  const out = [];
  for (const n of numbers) {
    const want = expected?.[n];
    if (!want) {
      out.push({ gameweek: n, league: "*", expected: null, actual: null });
      continue;
    }
    for (const league of ULTIMA_LEAGUES) {
      const actual = counts?.[n]?.[league] ?? 0;
      if (actual !== want[league]) out.push({ gameweek: n, league, expected: want[league], actual });
    }
  }
  return out;
}

const HOUR_MS = 60 * 60 * 1000;
/** A gameweek opening within this many hours must have fixtures in every league. */
export const EMPTY_LEAGUE_WARN_HOURS = 72;
const SEASON_HORIZON_DAYS = 3650;

/** Gameweeks that have not ended yet, for the season scope. */
export function seasonCandidates(gameweeks, now) {
  return gameweeks.filter((g) => g.window_end && new Date(g.window_end).getTime() > now.getTime());
}

/**
 * Fixture sync for chosen gameweeks. Dry run unless apply is true.
 * Counts are per league per gameweek, by window. Only fixtures that fall inside
 * a chosen gameweek are written, each tagged with that gameweek. Server only.
 * When `expected` is given and apply is true, nothing is written unless counts match it.
 *
 * scope "season" covers every gameweek that has not ended, to the last one. It also
 * sets league_open_at from the first real kickoff per league per gameweek. A league
 * with no fixtures in a gameweek is skipped (nothing is estimated), and a league that
 * returns no fixtures at all blocks the write.
 *
 * @param {{db: object, competitionId: string, numbers?: number[]|null, scope?: string|null, apply?: boolean, expected?: object|null, now?: Date}} input
 */
export async function runFixtureSync({ db, competitionId, numbers = null, scope = null, apply = false, expected = null, now = new Date() }) {
  const { data: rows, error } = await db
    .from("ultima_gameweeks")
    .select("id, number, state, window_start, window_end, league_open_at")
    .eq("competition_id", competitionId)
    .order("number", { ascending: true });
  if (error) throw new Error(`Could not read gameweeks: ${error.message}`);

  const all = rows ?? [];
  const season = scope === "season";
  const chosen = numbers?.length
    ? all.filter((g) => numbers.includes(g.number))
    : season
      ? seasonCandidates(all, now)
      : refreshCandidates(all, now);
  const report = { apply, scope: season ? "season" : "window", gameweeks: [], counts: {}, errors: [], warnings: [], written: 0 };
  if (!chosen.length) return report;

  report.gameweeks = chosen.map((g) => g.number);
  const from = chosen.reduce((a, g) => (g.window_start < a ? g.window_start : a), chosen[0].window_start);
  const to = chosen.reduce((a, g) => (g.window_end > a ? g.window_end : a), chosen[0].window_end);

  const fetched = await fetchWindowFixtures({ from, to });
  if (!fetched.ok) {
    report.errors.push(fetched.error);
    return report;
  }
  for (const pack of fetched.packs) if (pack.error) report.errors.push(`${pack.league}: ${pack.error}`);

  const inWindow = fetched.packs.map((pack) => ({
    ...pack,
    fixtures: pack.fixtures.filter((f) => gameweekForKickoff(f.kickoff_at ?? f.kickoff, chosen)),
  }));
  report.counts = countByGameweek(
    inWindow.flatMap((p) => p.fixtures.map((f) => ({ ...f, league: p.league }))),
    chosen,
  );
  report.leagues = ULTIMA_LEAGUES;

  const readable = fetched.packs.filter((p) => !p.error).map((p) => p.league);
  if (season) {
    for (const pack of fetched.packs) {
      if (!pack.error && !pack.fixtures.length) report.errors.push(`${pack.league}: no fixtures returned for the season`);
    }
  }

  // Season scope only: set league_open_at from real kickoffs. Never plan for a league we could not
  // read; a league with no fixtures in a gameweek keeps what it has (nothing is estimated).
  let openAtUpdates = [];
  if (season) {
    const plan = planOpenAtRefresh({
      gameweeks: chosen,
      fixtures: inWindow
        .filter((p) => readable.includes(p.league))
        .flatMap((p) => p.fixtures.map((f) => ({ league: p.league, kickoff: new Date(kickoffMs(f.kickoff_at ?? f.kickoff)).toISOString() }))),
      now,
      horizonDays: SEASON_HORIZON_DAYS,
    });
    openAtUpdates = plan.updates
      .map((u) => ({ ...u, changes: u.changes.filter((c) => readable.includes(c.league)) }))
      .filter((u) => u.changes.length);
    report.openAt = {
      changes: openAtUpdates.flatMap((u) => u.changes),
      noFixtures: plan.noFixtures.filter((n) => readable.includes(n.league)),
      skippedPast: plan.skippedPast,
      applied: 0,
    };
  }

  // A gameweek about to open with a league that has no fixtures is flagged for a human.
  for (const g of chosen) {
    const startsIn = new Date(g.window_start).getTime() - now.getTime();
    if (startsIn > EMPTY_LEAGUE_WARN_HOURS * HOUR_MS) continue;
    for (const league of readable) {
      if ((report.counts[g.number]?.[league] ?? 0) === 0) {
        const msg = `GW${g.number} ${league}: 0 fixtures within ${EMPTY_LEAGUE_WARN_HOURS}h of opening`;
        report.warnings.push(msg);
        console.error(`ultima fixture-sync warning ${msg}`);
      }
    }
  }

  if (expected) {
    report.mismatches = compareExpected(report.counts, expected, report.gameweeks);
    report.guard = report.mismatches.length ? "mismatch" : "match";
  }

  // Never write while any league could not be read: counts would be partial.
  // With an expected table, never write unless every count matches it exactly.
  if (apply && !report.errors.length && !report.mismatches?.length) {
    const result = await upsertFixturePacks(db, inWindow, chosen);
    report.written = result.synced;
    report.errors.push(...result.errors);
    if (!result.errors.length && openAtUpdates.length) {
      const opened = await applyOpenAtRefresh(db, openAtUpdates);
      report.openAt.applied = opened.applied;
      report.errors.push(...opened.errors.map((e) => `GW${e.number} league_open_at: ${e.message}`));
    }
  }
  return report;
}
