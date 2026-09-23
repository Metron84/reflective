import { ULTIMA_LEAGUES, ULTIMA_XI_FLOOR_PER_LEAGUE } from "@/lib/ultima/constants";
import { emptyLineupTemplate } from "@/lib/ultima/lineup/slots";
import { expectedUltimaPoints } from "@/lib/ultima/projected-points";

export function playerExpected(player) {
  const n = Number(player?.expectedPoints);
  if (Number.isFinite(n)) return n;
  return expectedUltimaPoints(player);
}

/** Top 3 expected points per country. Locked leagues keep the current XV. */
export function bestXvLineup(roster = [], lineup = [], lockedLeagues = []) {
  const locked = new Set(lockedLeagues);
  const next = emptyLineupTemplate().map((slot) => {
    const current = lineup.find((row) => row.slot === slot.slot);
    return {
      ...slot,
      player_id: current?.player_id ?? null,
      locked_at: current?.locked_at ?? null,
      auto_started: current?.auto_started ?? false,
    };
  });

  for (const league of ULTIMA_LEAGUES) {
    if (locked.has(league)) continue;
    const top = [...roster]
      .filter((player) => player.league === league)
      .sort((a, b) => playerExpected(b) - playerExpected(a))
      .slice(0, ULTIMA_XI_FLOOR_PER_LEAGUE);
    const slots = next.filter((row) => row.slot_group === league);
    slots.forEach((row, index) => {
      row.player_id = top[index]?.id ?? null;
      row.auto_started = false;
    });
  }

  return next;
}

export function xvDiff(rosterById, before, after) {
  const beforeIds = new Set((before ?? []).map((row) => row.player_id).filter(Boolean));
  const afterIds = new Set((after ?? []).map((row) => row.player_id).filter(Boolean));
  const inn = [...afterIds]
    .filter((id) => !beforeIds.has(id))
    .map((id) => rosterById.get(id))
    .filter(Boolean);
  const out = [...beforeIds]
    .filter((id) => !afterIds.has(id))
    .map((id) => rosterById.get(id))
    .filter(Boolean);
  return { inn, out };
}
