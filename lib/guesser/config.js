// The Guesser configuration. Melo-approved decisions live here.

export const GUESSER_MODES = [
  { slug: "classic", name: "Classic", free: true },
  { slug: "world_cup", name: "World Cup Legends", free: false },
  { slug: "premier_league", name: "Premier League", free: false },
  { slug: "la_liga", name: "La Liga", free: false },
  { slug: "serie_a", name: "Serie A", free: false },
  { slug: "bundesliga", name: "Bundesliga", free: false },
  { slug: "ligue_1", name: "Ligue 1", free: false },
];

// A mode only ships if its pool clears this size (Melo, Jul 13 2026).
export const MIN_MODE_POOL_SIZE = 20;

export const MAX_ATTEMPTS = 6;

// Puzzle #1 for every mode. Rotation is midnight GST (UTC+4).
export const GUESSER_EPOCH = "2026-07-13";

// Current calendar day in GST as yyyy-mm-dd.
export function gstDay(now = new Date()) {
  const shifted = new Date(now.getTime() + 4 * 3600_000);
  return shifted.toISOString().slice(0, 10);
}

export function puzzleNumber(day = gstDay()) {
  const diff = Math.round(
    (new Date(`${day}T00:00:00Z`) - new Date(`${GUESSER_EPOCH}T00:00:00Z`)) /
      86400000
  );
  return diff + 1;
}
