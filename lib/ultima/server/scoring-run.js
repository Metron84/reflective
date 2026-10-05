import { captainIdSet, resolveCaptains } from "@/lib/ultima/captains";
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

  // One read for every XV this gameweek, one for last gameweek's captains.
  const { data: allLineups } = await db
    .from("ultima_lineups")
    .select("*")
    .eq("gameweek_id", gameweekId);
  const prevCaptains = await lastWeekCaptains(db, gw);

  for (const manager of managers ?? []) {
    const lineupRows = (allLineups ?? []).filter((r) => r.manager_id === manager.id);

    // Explicit captain per country, else last week's if he is still in the XV.
    const captains = resolveCaptains(lineupRows, prevCaptains.get(manager.id));
    const captainIds = captainIdSet(captains.byLeague);
    await persistCarriedCaptains(db, manager.id, gameweekId, lineupRows, captains);

    const lineup = lineupRows
      .filter((r) => r.player_id)
      .map((r) => {
        const player = playersById.get(r.player_id);
        return {
          slot: r.slot,
          captain: captainIds.has(r.player_id),
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

    // points carries the captain's extra; bolt stays its own column.
    await db.from("ultima_manager_gameweek_scores").upsert(
      {
        manager_id: manager.id,
        gameweek_id: gameweekId,
        points: scored.baseTotal + scored.captainTotal,
        bolt_points: scored.boltTotal,
        state,
      },
      { onConflict: "manager_id,gameweek_id" },
    );
  }

  return { ok: true };
}

/** manager id -> { league: player id } for the gameweek before this one. */
async function lastWeekCaptains(db, gw) {
  const out = new Map();
  if (!gw?.number || gw.number <= 1) return out;
  const { data: prev } = await db
    .from("ultima_gameweeks")
    .select("id")
    .eq("competition_id", gw.competition_id)
    .eq("number", gw.number - 1)
    .maybeSingle();
  if (!prev?.id) return out;
  const { data: rows, error } = await db
    .from("ultima_lineups")
    .select("manager_id, slot_group, player_id")
    .eq("gameweek_id", prev.id)
    .eq("is_captain", true);
  if (error) return out;
  for (const r of rows ?? []) {
    const map = out.get(r.manager_id) ?? {};
    map[r.slot_group] = r.player_id;
    out.set(r.manager_id, map);
  }
  return out;
}

/** Write a carried captain onto this week's row so next week can carry him again. */
async function persistCarriedCaptains(db, managerId, gameweekId, lineupRows, captains) {
  for (const [league, carried] of Object.entries(captains.carried)) {
    const playerId = captains.byLeague[league];
    if (!carried || !playerId) continue;
    const row = lineupRows.find((r) => r.player_id === playerId);
    if (!row) continue;
    const { error } = await db
      .from("ultima_lineups")
      .update({ is_captain: true })
      .eq("manager_id", managerId)
      .eq("gameweek_id", gameweekId)
      .eq("slot", row.slot);
    if (error) console.error("[ultima/scoring] carry captain failed", error.message);
  }
}

export async function getStandings(competitionId, gameweekId = null) {
  const db = getUltimaDb();
  if (!db) return [];

  const { data: managers } = await db
    .from("ultima_managers")
    .select("id, team_name, manager_name, colour, is_bot, persona_id")
    .eq("competition_id", competitionId)
    .order("draft_slot");

  const { data: personas } = await db
    .from("ultima_bot_personas")
    .select("id, name");
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

  const rows = (managers ?? []).map((m) => {
    const persona = m.is_bot ? personaById.get(m.persona_id) : null;
    return {
      id: m.id,
      team_name: m.team_name,
      manager_name: m.manager_name,
      colour: m.colour,
      is_bot: m.is_bot,
      persona_name: persona?.name ?? null,
      seasonPoints: seasonTotals.get(m.id) ?? 0,
      gameweekPoints: gwPoints.get(m.id) ?? null,
      boltPoints: boltTotals.get(m.id) ?? 0,
    };
  });

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
