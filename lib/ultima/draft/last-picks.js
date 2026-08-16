/** Newest first. Used by the live last-picks strip. */
export function lastPicksNewestFirst(picks = [], limit = 5) {
  return [...picks]
    .filter((p) => p && p.pick_number != null)
    .sort((a, b) => b.pick_number - a.pick_number)
    .slice(0, limit);
}

export function playerSurname(name) {
  const parts = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return parts[parts.length - 1] || "Unknown";
}
