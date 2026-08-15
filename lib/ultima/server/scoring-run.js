import { scoreLineup } from "@/lib/ultima/scoring";
import { getUltimaDb } from "@/lib/ultima/server/db";

export async function recomputeGameweekScores(competitionId, gameweekId) {
  const db = getUltimaDb();
  if (!db) return { ok: false };

  const [{ data: competition }, { data: managers }, { data: gw }] = await Promise.all([
    db.from("ultima_competition").select("rating_thresholds").eq("id", competitionId).maybeSingle(),
    db.from("ultima_managers").select("id").eq("competition_id", competitionId),
    db.from("ultima_gameweeks").select("*").eq("id", gameweekId).maybeSingle(),
  ]);

  if (!gw) return { ok: false, error: "no_gw" };

  const thresholds = competition?.rating_thresholds ?? {};

  const { data: fixtures } = await db
    .from("ultima_fixtures")
    .select("id")
    .eq("gameweek_id", gameweekId);

  const fixtureIds = (fixtures ?? []).map((f) => f.id);

  const { data: allStats } = fixtureIds.length
    ? await db
        .from("ultima_player_match_stats")
        .select("*")
        .in("fixture_id", fixtureIds)
    : { data: [] };

  const statsByPlayer = new Map();
  for (const s of allStats ?? []) {
    const list = statsByPlayer.get(s.player_id) ?? [];
    list.push(s);
    statsByPlayer.set(s.player_id, list);
  }

  const { data: allPlayers } = await db.from("ultima_players").select("*");
  const playersById = new Map((allPlayers ?? []).map((p) => [p.id, p]));

  for (const manager of managers ?? []) {
    const { data: lineupRows } = await db
      .from("ultima_lineups")
      .select("*")
      .eq("manager_id", manager.id)
      .eq("gameweek_id", gameweekId);

    const lineup = (lineupRows ?? [])
      .filter((r) => r.player_id)
      .map((r) => {
        const player = playersById.get(r.player_id);
        return {
          slot: r.slot,
          player: {
            id: player?.id,
            league: player?.league,
            draftRound: player?.draft_round,
            undraftedFa: !player?.draft_round && player?.bolt_eligible,
          },
          fixtureStats: statsByPlayer.get(r.player_id) ?? [],
        };
      });

    const scored = scoreLineup(lineup, thresholds);
    const state = gw.state === "final" ? "final" : "provisional";

    await db.from("ultima_manager_gameweek_scores").upsert(
      {
        manager_id: manager.id,
        gameweek_id: gameweekId,
        points: scored.total - scored.boltTotal,
        bolt_points: scored.boltTotal,
        state,
      },
      { onConflict: "manager_id,gameweek_id" },
    );
  }

  return { ok: true };
}

export async function getStandings(competitionId, gameweekId = null) {
  const db = getUltimaDb();
  if (!db) return [];

  const { data: managers } = await db
    .from("ultima_managers")
    .select("id, team_name, manager_name, colour, is_bot, persona_id")
    .eq("competition_id", competitionId)
    .order("draft_slot");

  const { data: personas } = await db.from("ultima_bot_personas").select("*");
  const personaById = new Map((personas ?? []).map((p) => [p.id, p]));

  let scoresQuery = db
    .from("ultima_manager_gameweek_scores")
    .select("*, ultima_gameweeks(number)");

  if (gameweekId) {
    scoresQuery = scoresQuery.eq("gameweek_id", gameweekId);
  }

  const { data: scores } = await scoresQuery;

  const seasonTotals = new Map();
  const gwPoints = new Map();
  const boltTotals = new Map();

  for (const s of scores ?? []) {
    seasonTotals.set(s.manager_id, (seasonTotals.get(s.manager_id) ?? 0) + Number(s.points) + Number(s.bolt_points));
    boltTotals.set(s.manager_id, (boltTotals.get(s.manager_id) ?? 0) + Number(s.bolt_points));
    if (gameweekId && s.gameweek_id === gameweekId) {
      gwPoints.set(s.manager_id, Number(s.points) + Number(s.bolt_points));
    }
  }

  const rows = (managers ?? []).map((m) => ({
    ...m,
    persona: m.is_bot ? personaById.get(m.persona_id) : null,
    seasonPoints: seasonTotals.get(m.id) ?? 0,
    gameweekPoints: gwPoints.get(m.id) ?? null,
    boltPoints: boltTotals.get(m.id) ?? 0,
  }));

  rows.sort((a, b) => b.seasonPoints - a.seasonPoints);

  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

export async function getBoltBoard(competitionId) {
  const db = getUltimaDb();
  if (!db) return [];

  const { data: scores } = await db
    .from("ultima_manager_gameweek_scores")
    .select("manager_id, bolt_points, ultima_managers(team_name)")
    .gt("bolt_points", 0);

  const byManager = new Map();
  for (const s of scores ?? []) {
    byManager.set(s.manager_id, {
      manager_id: s.manager_id,
      team_name: s.ultima_managers?.team_name,
      bolt: (byManager.get(s.manager_id)?.bolt ?? 0) + Number(s.bolt_points),
    });
  }

  return [...byManager.values()].sort((a, b) => b.bolt - a.bolt).slice(0, 5);
}
