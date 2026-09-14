/** Minimum raw-fit lead required for a Tier B club to become primary over Tier A. Intra-stratum only. */
export const TIER_B_PRIMARY_MARGIN = 0.02;

/**
 * @param {{ tier?: string|null }} club
 * @returns {'A' | 'B'}
 */
export function tierOf(club) {
  return club.tier === "B" ? "B" : "A";
}

/**
 * Optional league or division label for result copy (Tier B imports).
 * @param {{ competition?: string|null; tier?: string|null }} club
 */
export function competitionLabel(club) {
  if (club.competition && String(club.competition).trim()) {
    return String(club.competition).trim();
  }
  return null;
}

const TOP_FLIGHT_COMPETITIONS = new Set([
  "Premier League",
  "Serie A",
  "LaLiga",
  "Bundesliga",
  "Ligue 1",
]);

/**
 * Display name with division when outside a top flight.
 * @param {{ common_name?: string; name: string; competition?: string|null }} club
 */
export function describeMatchClub(club) {
  const base = club.common_name || club.name;
  const comp = competitionLabel(club);
  if (!comp || TOP_FLIGHT_COMPETITIONS.has(comp)) return base;
  return `${base} (${comp})`;
}
