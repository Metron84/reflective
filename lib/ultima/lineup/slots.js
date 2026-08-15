import {
  ULTIMA_LEAGUES,
  ULTIMA_XI_FLOOR_PER_LEAGUE,
  ULTIMA_XI_SIZE,
  leagueLabel,
} from "@/lib/ultima/constants";

/** v5: 15 slots, exactly 3 per league (no free slots). */
export const XI_SLOT_LAYOUT = ULTIMA_LEAGUES.flatMap((league) =>
  [1, 2, 3].map((_, i) => ({
    slot:
      ULTIMA_LEAGUES.indexOf(league) * ULTIMA_XI_FLOOR_PER_LEAGUE + i + 1,
    slot_group: league,
  })),
);

export function emptyLineupTemplate() {
  return XI_SLOT_LAYOUT.map(({ slot, slot_group }) => ({
    slot,
    slot_group,
    player_id: null,
    locked_at: null,
    auto_started: false,
  }));
}

/**
 * Count filled XI slots per league (v5: slot_group always equals player league).
 */
export function xiLeagueCounts(lineup, playersById) {
  const counts = Object.fromEntries(ULTIMA_LEAGUES.map((l) => [l, 0]));
  for (const row of lineup) {
    if (!row.player_id) continue;
    const player = playersById.get(row.player_id);
    if (!player) continue;
    counts[row.slot_group] = (counts[row.slot_group] ?? 0) + 1;
  }
  return counts;
}

/**
 * Validate XI meets 3-per-league floor across all five leagues.
 */
export function validateXiFloors(lineup, playersById) {
  const counts = xiLeagueCounts(lineup, playersById);
  const missing = ULTIMA_LEAGUES.filter(
    (l) => counts[l] < ULTIMA_XI_FLOOR_PER_LEAGUE,
  );
  if (missing.length === 0) return { ok: true };
  return {
    ok: false,
    reason: `One more from ${leagueLabel(missing[0])}.`,
    missing,
  };
}

/**
 * Player must match slot league (v5: no cross-league free slots).
 */
export function canPlaceInSlot(player, slotGroup) {
  return player.league === slotGroup;
}

export function filledXiCount(lineup) {
  return lineup.filter((r) => r.player_id).length;
}

export function isXiComplete(lineup) {
  return filledXiCount(lineup) === ULTIMA_XI_SIZE;
}
