import { buildMatchday } from "@/lib/ultima/matchday";
import { getCurrentGameweek } from "@/lib/ultima/server/bootstrap";
import { getUltimaDb } from "@/lib/ultima/server/db";

/** manager id -> { league: player id } for the gameweek before this one. */
async function prevCaptainsByManager(db, gameweek) {
  const out = {};
  if (!gameweek?.number || gameweek.number <= 1) return out;
  const { data: prev } = await db
    .from("ultima_gameweeks")
    .select("id")
    .eq("competition_id", gameweek.competition_id)
    .eq("number", gameweek.number - 1)
    .maybeSingle();
  if (!prev?.id) return out;
  const { data, error } = await db
    .from("ultima_lineups")
    .select("manager_id, slot_group, player_id")
    .eq("gameweek_id", prev.id)
    .eq("is_captain", true);
  if (error) return out;
  for (const r of data ?? []) {
    out[r.manager_id] = { ...(out[r.manager_id] ?? {}), [r.slot_group]: r.player_id };
  }
  return out;
}

/**
 * Matchday data for the current gameweek: fixtures, this manager's XV, and every
 * manager's points. Reads only; the live refresh runs separately.
 */
export async function getMatchday({ competitionId, managerId, gameweek = null }) {
  const db = getUltimaDb();
  if (!db || !competitionId) return null;

  const gw = gameweek ?? (await getCurrentGameweek(competitionId));
  if (!gw) return buildMatchday({ gameweek: null });

  const [{ data: competition }, { data: managers }, { data: fixtures }, { data: lineups }, prevCaptains] =
    await Promise.all([
      db.from("ultima_competition").select("rating_thresholds").eq("id", competitionId).maybeSingle(),
      db
        .from("ultima_managers")
        .select("id, team_name, colour, is_bot")
        .eq("competition_id", competitionId)
        .order("draft_slot"),
      db
        .from("ultima_fixtures")
        .select(
          "id, league, kickoff, kickoff_at, status, home_club, away_club, home_score, away_score",
        )
        .eq("gameweek_id", gw.id)
        .order("kickoff", { ascending: true }),
      db.from("ultima_lineups").select("*").eq("gameweek_id", gw.id).not("player_id", "is", null),
      prevCaptainsByManager(db, gw),
    ]);

  const playerIds = [...new Set((lineups ?? []).map((r) => r.player_id))];
  const fixtureIds = (fixtures ?? []).map((f) => f.id);
  const [{ data: players }, { data: stats }] = await Promise.all([
    playerIds.length
      ? db.from("ultima_players").select("*").in("id", playerIds)
      : Promise.resolve({ data: [] }),
    playerIds.length && fixtureIds.length
      ? db
          .from("ultima_player_match_stats")
          .select("player_id, goals, assists, rating")
          .in("fixture_id", fixtureIds)
          .in("player_id", playerIds)
      : Promise.resolve({ data: [] }),
  ]);

  const view = buildMatchday({
    gameweek: gw,
    fixtures: fixtures ?? [],
    managers: managers ?? [],
    lineups: lineups ?? [],
    playersById: new Map((players ?? []).map((p) => [p.id, p])),
    stats: stats ?? [],
    prevCaptains,
    viewerManagerId: managerId,
    thresholds: competition?.rating_thresholds ?? undefined,
  });
  return { ...view, updatedAt: new Date().toISOString() };
}
