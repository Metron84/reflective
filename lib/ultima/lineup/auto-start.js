import { ULTIMA_LEAGUES, ULTIMA_XI_FLOOR_PER_LEAGUE } from "@/lib/ultima/constants";
import { emptyLineupTemplate } from "@/lib/ultima/lineup/slots";

function draftRank(player) {
  const round = Number(player?.draft_round);
  return Number.isFinite(round) ? round : Number.POSITIVE_INFINITY;
}

function isStartable(player) {
  if (!player?.id || !ULTIMA_LEAGUES.includes(player.league)) return false;
  if (player.inactive_flag) return false;
  if (player.active === false) return false;
  return true;
}

/**
 * First valid XV: walk the squad in draft order and take three startable
 * players from each league. Filled slots are marked auto_started.
 */
export function firstXvByDraftOrder(roster) {
  const ordered = [...(roster ?? [])]
    .filter(isStartable)
    .sort((a, b) => draftRank(a) - draftRank(b) || String(a.id).localeCompare(String(b.id)));

  const picked = Object.fromEntries(ULTIMA_LEAGUES.map((league) => [league, []]));
  for (const player of ordered) {
    const list = picked[player.league];
    if (list.length >= ULTIMA_XI_FLOOR_PER_LEAGUE) continue;
    list.push(player);
  }

  return emptyLineupTemplate().map((slot) => {
    const index = (slot.slot - 1) % ULTIMA_XI_FLOOR_PER_LEAGUE;
    const player = picked[slot.slot_group][index] ?? null;
    return {
      ...slot,
      player_id: player?.id ?? null,
      auto_started: Boolean(player),
    };
  });
}
