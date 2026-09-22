import { ULTIMA_LEAGUE_LABELS } from "@/lib/ultima/constants";
import { getCurrentGameweek } from "@/lib/ultima/server/bootstrap";
import { getUltimaDb } from "@/lib/ultima/server/db";

/**
 * Real-league board for the hub. Fixtures and scorers already synced.
 * Never invents a score.
 */
export async function getEuropeBoard(competitionId) {
  const db = getUltimaDb();
  if (!db || !competitionId) {
    return { gameweek: null, fixtures: [], movers: [] };
  }

  const gameweek = await getCurrentGameweek(competitionId);
  if (!gameweek?.id) {
    return { gameweek: null, fixtures: [], movers: [] };
  }

  const { data: fixtures } = await db
    .from("ultima_fixtures")
    .select("id, league, kickoff, status, home_club, away_club")
    .eq("gameweek_id", gameweek.id)
    .order("kickoff", { ascending: true })
    .limit(16);

  const rows = fixtures ?? [];
  const fixtureIds = rows.map((row) => row.id);
  let movers = [];

  if (fixtureIds.length) {
    const { data: stats } = await db
      .from("ultima_player_match_stats")
      .select("goals, assists, rating, player_id, ultima_players(name, club, league)")
      .in("fixture_id", fixtureIds)
      .or("goals.gt.0,assists.gt.0")
      .order("goals", { ascending: false })
      .limit(8);

    movers = (stats ?? [])
      .map((row) => {
        const player = row.ultima_players;
        if (!player?.name) return null;
        return {
          name: player.name,
          club: player.club,
          league: player.league,
          leagueLabel: ULTIMA_LEAGUE_LABELS[player.league] ?? player.league,
          goals: row.goals ?? 0,
          assists: row.assists ?? 0,
        };
      })
      .filter(Boolean);
  }

  return {
    gameweek: Number.isInteger(gameweek.number) ? gameweek.number : null,
    fixtures: rows.map((row) => ({
      id: row.id,
      league: row.league,
      leagueLabel: ULTIMA_LEAGUE_LABELS[row.league] ?? row.league,
      kickoff: row.kickoff,
      status: row.status ?? "scheduled",
      home: row.home_club,
      away: row.away_club,
    })),
    movers,
  };
}
