import { linkNullStatPlayers, loadPlayerIndex } from "@/lib/ultima/server/link-stats";
import { recomputeGameweekScores } from "@/lib/ultima/server/scoring-run";
import { autoStartUnsetLineups } from "@/lib/ultima/server/auto-start-lineups";
import { getActiveCompetition } from "@/lib/ultima/server/db";
import { getLoggedDb } from "@/lib/ultima/server/strict-db";

const LINK_PAGE = 400;
const LINK_MAX_PAGES = 200;

/**
 * One gameweek, in order: link null stat rows on its fixtures, auto-start
 * managers with no lineup, then rewrite every manager's score.
 * Shared by the cron-secret route and the commissioner button.
 */
export async function recomputeGameweekByNumber(gameweekNumber) {
  const number = Number(gameweekNumber);
  if (!Number.isInteger(number) || number < 1) {
    return { ok: false, code: "INVALID", message: "gameweek must be a whole number." };
  }
  const db = getLoggedDb("ultima/recompute");
  if (!db) return { ok: false, code: "UNAVAILABLE", message: "No database." };
  const competition = await getActiveCompetition();
  if (!competition) return { ok: false, code: "UNAVAILABLE", message: "No active competition." };

  const { data: gw } = await db
    .from("ultima_gameweeks")
    .select("id, number")
    .eq("competition_id", competition.id)
    .eq("number", number)
    .maybeSingle();
  if (!gw) return { ok: false, code: "NOT_FOUND", message: `Gameweek ${number} not found.` };

  const { data: fixtures } = await db
    .from("ultima_fixtures")
    .select("id")
    .eq("gameweek_id", gw.id);
  const fixtureIds = (fixtures ?? []).map((row) => row.id);

  let rowsLinked = 0;
  if (fixtureIds.length) {
    const loaded = await loadPlayerIndex(db);
    if (loaded.error) return { ok: false, code: "UNAVAILABLE", message: loaded.error };
    let cursor = null;
    for (let pass = 0; pass < LINK_MAX_PAGES; pass += 1) {
      const page = await linkNullStatPlayers(db, {
        cursor,
        limit: LINK_PAGE,
        index: loaded.index,
        fixtureIds,
      });
      if (page.error) return { ok: false, code: "UNAVAILABLE", message: page.error, rows_linked: rowsLinked };
      rowsLinked += page.linked ?? 0;
      cursor = page.cursor ?? cursor;
      if (page.done) break;
    }
  }

  const started = await autoStartUnsetLineups(db, gw.id);
  if (started.error) return { ok: false, code: "UNAVAILABLE", message: started.error, rows_linked: rowsLinked };

  const scored = await recomputeGameweekScores(competition.id, gw.id);
  if (!scored?.ok) {
    return { ok: false, code: "UNAVAILABLE", message: scored?.error ?? "Rescore failed.", rows_linked: rowsLinked };
  }

  return {
    ok: true,
    gameweek: number,
    rows_linked: rowsLinked,
    lineups_autostarted: started.started ?? 0,
    managers: (scored.scores ?? []).map((row) => ({
      team_name: row.team_name,
      points: row.base_points,
      captain_bonus: row.captain_bonus,
      bolt_points: row.bolt_points,
      total: row.points + row.bolt_points,
    })),
  };
}
