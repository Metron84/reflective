import { ULTIMA_LEAGUES, ULTIMA_XI_FLOOR_PER_LEAGUE } from "@/lib/ultima/constants";
import { emptyLineupTemplate } from "@/lib/ultima/lineup/slots";
import { chooseBotPick } from "@/lib/ultima/bots/pick";
import { getBotPersonaById } from "@/lib/ultima/personas";
import { getUltimaDb } from "@/lib/ultima/server/db";
import { recordUltimaEvent } from "@/lib/ultima/server/record-event";
import { getManagerRoster } from "@/lib/ultima/server/lineup";

/**
 * Bot weekly XV: fill 3 per league from roster using persona-weighted picks.
 */
export async function setBotLineup(managerId, gameweekId) {
  const db = getUltimaDb();
  if (!db) return { ok: false };

  const { data: manager } = await db
    .from("ultima_managers")
    .select("*, ultima_bot_personas(*)")
    .eq("id", managerId)
    .maybeSingle();

  if (!manager?.is_bot) return { ok: false, reason: "not_bot" };

  const roster = await getManagerRoster(managerId);
  const persona =
    getBotPersonaById(manager.persona_id) ?? manager.ultima_bot_personas ?? null;

  const template = emptyLineupTemplate();
  const used = new Set();

  for (const league of ULTIMA_LEAGUES) {
    const leaguePool = roster.filter((p) => p.league === league && !used.has(p.id));
    const slots = template.filter((s) => s.slot_group === league);

    for (let i = 0; i < ULTIMA_XI_FLOOR_PER_LEAGUE; i += 1) {
      const available = leaguePool.filter((p) => !used.has(p.id));
      if (!available.length) break;

      let pick = available[0];
      if (persona) {
        const chosen = chooseBotPick({
          persona,
          availablePlayers: available.map((p) => ({
            ...p,
            seed_metrics: p.seed_metrics ?? {},
          })),
          managerCounts: {},
          slotsLeft: 1,
          supplyByLeague: { [league]: available.length },
          draftRound: 1,
        });
        if (chosen?.player) {
          pick = available.find((p) => p.provider_id === chosen.player.provider_id) ?? pick;
        }
      }

      used.add(pick.id);
      slots[i].player_id = pick.id;
    }
  }

  for (const row of template) {
    await db.from("ultima_lineups").upsert(
      {
        manager_id: managerId,
        gameweek_id: gameweekId,
        slot: row.slot,
        slot_group: row.slot_group,
        player_id: row.player_id,
        auto_started: Boolean(row.player_id),
      },
      { onConflict: "manager_id,gameweek_id,slot" },
    );
  }

  await recordUltimaEvent({
    event: "xi_auto_started",
    managerId,
    payload: { gameweek_id: gameweekId, bot: true },
  });

  return { ok: true };
}

export async function autoStartBotsForGameweek(competitionId, gameweekId) {
  const db = getUltimaDb();
  const { data: bots } = await db
    .from("ultima_managers")
    .select("id")
    .eq("competition_id", competitionId)
    .eq("is_bot", true);

  for (const bot of bots ?? []) {
    await setBotLineup(bot.id, gameweekId);
  }

  return { ok: true, count: bots?.length ?? 0 };
}
