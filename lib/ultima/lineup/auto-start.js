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
 * First valid XV (startable players first, then unavailable ones only to fill a league): walk the squad in draft order and take three startable
 * players from each league. Filled slots are marked auto_started.
 */
export function firstXvByDraftOrder(roster) {
  const byDraft = (a, b) => draftRank(a) - draftRank(b) || String(a.id).localeCompare(String(b.id));
  const inLeagues = [...(roster ?? [])].filter((p) => p?.id && ULTIMA_LEAGUES.includes(p.league));
  // Startable players first; a league short of three then borrows from its unavailable players.
  const ordered = [
    ...inLeagues.filter(isStartable).sort(byDraft),
    ...inLeagues.filter((p) => !isStartable(p)).sort(byDraft),
  ];

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

/** Leagues that still have an empty slot after auto-start. Only a roster missing players causes this. */
export function shortLeagues(xv) {
  return ULTIMA_LEAGUES.filter((league) => xv.filter((r) => r.slot_group === league && r.player_id).length < ULTIMA_XI_FLOOR_PER_LEAGUE);
}
