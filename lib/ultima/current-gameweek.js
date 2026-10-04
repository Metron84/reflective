/**
 * Which gameweek is "current". Pure, no I/O. One rule for every caller:
 * the gameweek whose window contains now, else (an international break, or
 * before GW1) the next upcoming gameweek by window_start. After the last
 * gameweek there is no current one.
 */
const at = (value) => new Date(value).getTime();

export function pickCurrentGameweek(gameweeks, now = new Date()) {
  const t = now instanceof Date ? now.getTime() : at(now);
  const rows = (gameweeks ?? []).filter((g) => g?.window_start && g?.window_end);

  const inside = rows
    .filter((g) => at(g.window_start) <= t && t <= at(g.window_end))
    .sort((a, b) => at(a.window_start) - at(b.window_start));
  if (inside.length) return inside[0];

  const next = rows
    .filter((g) => g.state === "upcoming" && at(g.window_start) > t)
    .sort((a, b) => at(a.window_start) - at(b.window_start));
  return next[0] ?? null;
}

/** The most recent gameweek whose window has ended, or null. */
export function pickPreviousGameweek(gameweeks, now = new Date()) {
  const t = now instanceof Date ? now.getTime() : at(now);
  const ended = (gameweeks ?? [])
    .filter((g) => g?.window_end && at(g.window_end) < t)
    .sort((a, b) => at(b.window_end) - at(a.window_end));
  return ended[0] ?? null;
}
