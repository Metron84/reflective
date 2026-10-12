import { firstXvByDraftOrder, shortLeagues } from "@/lib/ultima/lineup/auto-start";
import { recordUltimaEvent } from "@/lib/ultima/server/record-event";

/** Managers with no lineup rows for this gameweek get the draft-order XV. */
export async function autoStartUnsetLineups(db, gameweekId) {
  if (!db || !gameweekId) return { started: 0 };

  const { data: gw, error: gwError } = await db
    .from("ultima_gameweeks")
    .select("id, competition_id")
    .eq("id", gameweekId)
    .maybeSingle();
  if (gwError || !gw) return { started: 0, error: gwError?.message ?? "no_gameweek" };

  const [{ data: managers }, { data: existing }] = await Promise.all([
    db.from("ultima_managers").select("id").eq("competition_id", gw.competition_id),
    db.from("ultima_lineups").select("manager_id").eq("gameweek_id", gameweekId),
  ]);

  const have = new Set((existing ?? []).map((row) => row.manager_id));
  const missing = (managers ?? []).filter((manager) => !have.has(manager.id));
  let started = 0;
  const short = [];

  for (const manager of missing) {
    const { data: roster, error: rosterError } = await db
      .from("ultima_rosters")
      .select("player_id, ultima_players(id, league, draft_round, inactive_flag, active)")
      .eq("manager_id", manager.id);
    if (rosterError) continue;
    const players = (roster ?? []).map((row) => row.ultima_players).filter(Boolean);
    const full = firstXvByDraftOrder(players);
    const missingLeagues = shortLeagues(full);
    if (missingLeagues.length) short.push({ manager_id: manager.id, leagues: missingLeagues });
    const lineup = full.filter((row) => row.player_id);
    if (!lineup.length) continue;
    const { error } = await db.from("ultima_lineups").insert(
      lineup.map((row) => ({
        manager_id: manager.id,
        gameweek_id: gameweekId,
        slot: row.slot,
        slot_group: row.slot_group,
        player_id: row.player_id,
        auto_started: true,
      })),
    );
    if (error) continue;
    started += 1;
    await recordUltimaEvent({
      event: "xi_auto_started",
      managerId: manager.id,
      competitionId: gw.competition_id,
      payload: { gameweek_id: gameweekId, draft_order: true },
    });
  }

  return { started, short };
}
