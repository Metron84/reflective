import { ULTIMA_LEAGUES } from "@/lib/ultima/constants";
import { countByGameweek, gameweekForKickoff } from "@/lib/ultima/fixture-mapping";
import { refreshCandidates } from "@/lib/ultima/gameweek-refresh";
import { fetchWindowFixtures, upsertFixturePacks } from "@/lib/ultima/server/sync";

/**
 * Fixture sync for chosen gameweeks. Dry run unless apply is true.
 * Counts are per league per gameweek, by window. Only fixtures that fall inside
 * a chosen gameweek are written, each tagged with that gameweek. Server only.
 *
 * @param {{db: object, competitionId: string, numbers?: number[]|null, apply?: boolean, now?: Date}} input
 */
export async function runFixtureSync({ db, competitionId, numbers = null, apply = false, now = new Date() }) {
  const { data: rows, error } = await db
    .from("ultima_gameweeks")
    .select("id, number, state, window_start, window_end")
    .eq("competition_id", competitionId)
    .order("number", { ascending: true });
  if (error) throw new Error(`Could not read gameweeks: ${error.message}`);

  const all = rows ?? [];
  const chosen = numbers?.length ? all.filter((g) => numbers.includes(g.number)) : refreshCandidates(all, now);
  const report = { apply, gameweeks: [], counts: {}, errors: [], written: 0 };
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

  // Never write while any league could not be read: counts would be partial.
  if (apply && !report.errors.length) {
    const result = await upsertFixturePacks(db, inWindow, chosen);
    report.written = result.synced;
    report.errors.push(...result.errors);
  }
  return report;
}
