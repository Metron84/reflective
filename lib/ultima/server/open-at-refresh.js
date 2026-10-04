import { ULTIMA_LEAGUES } from "@/lib/ultima/constants";
import { addDays, leagueIdsFromEnv, makeSportmonks } from "@/lib/ultima/sportmonks-fixtures";
import { applyOpenAtRefresh, planOpenAtRefresh, refreshCandidates } from "@/lib/ultima/gameweek-refresh";

const gst = (iso) => (iso ? iso.replace("T", " ").slice(0, 16) : "none");

/**
 * Reads upcoming gameweeks and fresh Sportmonks kickoffs, plans the league_open_at
 * refresh and, when apply is true, writes it. Server only. Logs gameweek, league,
 * old time and new time for every change. A league whose fixtures cannot be read
 * is left as it is and reported in errors.
 */
export async function runOpenAtRefresh({ db, key, competitionId, now = new Date(), apply = false, log = console.log }) {
  const { data: rows, error } = await db
    .from("ultima_gameweeks")
    .select("id, number, state, window_start, window_end, league_open_at")
    .eq("competition_id", competitionId)
    .eq("state", "upcoming")
    .order("number", { ascending: true });
  if (error) throw new Error(`Could not read gameweeks: ${error.message}`);

  const candidates = refreshCandidates(rows ?? [], now);
  const report = { apply, candidates: candidates.map((g) => g.number), changes: [], skippedPast: [], noFixtures: [], errors: [], applied: 0 };
  if (!candidates.length) return report;

  const from = candidates.reduce((a, g) => (g.window_start < a ? g.window_start : a), candidates[0].window_start).slice(0, 10);
  const lastEnd = candidates.reduce((a, g) => (g.window_end > a ? g.window_end : a), candidates[0].window_end).slice(0, 10);
  const sm = makeSportmonks(key);
  const leagueIds = leagueIdsFromEnv();
  const fixtures = [];
  const readable = [];

  for (const league of ULTIMA_LEAGUES) {
    try {
      const seasonId = await sm.seasonIdFor(leagueIds[league]);
      if (!seasonId) throw new Error("no 2026/27 season");
      const got = await sm.fetchLeagueFixtures({
        league,
        leagueId: leagueIds[league],
        seasonId,
        from: addDays(from, -1),
        to: addDays(lastEnd, 1),
      });
      fixtures.push(...got);
      readable.push(league);
    } catch (e) {
      report.errors.push({ league, message: e.message });
    }
  }

  // Never plan for a league we could not read.
  const plan = planOpenAtRefresh({
    gameweeks: candidates,
    fixtures: fixtures.filter((f) => readable.includes(f.league)),
    now,
  });
  report.skippedPast = plan.skippedPast;
  report.noFixtures = plan.noFixtures.filter((n) => readable.includes(n.league));

  const updates = plan.updates
    .map((u) => ({ ...u, changes: u.changes.filter((c) => readable.includes(c.league)) }))
    .filter((u) => u.changes.length);
  for (const u of updates) {
    for (const c of u.changes) {
      report.changes.push(c);
      log(`ultima open-at refresh GW${c.number} ${c.league}: ${gst(c.old)} -> ${gst(c.new)} (GST)${apply ? "" : " [dry run]"}`);
    }
  }

  if (apply && updates.length) {
    const result = await applyOpenAtRefresh(db, updates);
    report.applied = result.applied;
    report.errors.push(...result.errors);
  }
  return report;
}
