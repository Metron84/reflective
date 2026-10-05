/**
 * Client-side gate for queue saves. Returns the request body, or null when the save
 * must not fire: the saved queue has not loaded yet, or the list is empty and the
 * user did not clear it themselves.
 */
export function planQueueSave(loadedQueue, nextIds, { cleared = false } = {}) {
  if (!Array.isArray(loadedQueue)) return null;
  if (!nextIds.length && !cleared) return null;
  return { player_ids: nextIds, base_ids: loadedQueue.map((q) => q.player_id) };
}
