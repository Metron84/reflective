/**
 * Sportmonks id stored as the third dash field of provider_id.
 * `sm-pl-123` and `sm-player-123` both yield 123. Same rule as
 * split_part(provider_id, '-', 3).
 */
export function sportmonksIdFromProviderId(providerId) {
  const part = String(providerId ?? "").split("-")[2];
  if (part == null || !/^\d+$/.test(part)) return null;
  return Number(part);
}

/**
 * One Sportmonks id -> one player. Two players with the same id are not linked.
 * provider_id is the match. seed_metrics fills only ids that provider_id did not.
 */
export function indexPlayersBySportmonksId(players) {
  const map = new Map();
  const blocked = new Set();

  function add(smId, playerId) {
    if (smId == null || !playerId || blocked.has(smId)) return;
    const existing = map.get(smId);
    if (existing && existing !== playerId) {
      map.delete(smId);
      blocked.add(smId);
      return;
    }
    map.set(smId, playerId);
  }

  for (const player of players ?? []) {
    add(sportmonksIdFromProviderId(player.provider_id), player.id);
  }
  for (const player of players ?? []) {
    const fromMetrics = player.seed_metrics?.sportmonks_player_id ?? player.sportmonks_player_id;
    if (fromMetrics == null || !Number.isFinite(Number(fromMetrics))) continue;
    const smId = Number(fromMetrics);
    if (map.has(smId) || blocked.has(smId)) continue;
    add(smId, player.id);
  }
  return map;
}

export function playerIdForSportmonks(index, sportmonksPlayerId) {
  if (sportmonksPlayerId == null || sportmonksPlayerId === "") return null;
  const smId = Number(sportmonksPlayerId);
  if (!Number.isFinite(smId)) return null;
  return index.get(smId) ?? null;
}
