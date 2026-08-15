/** Ultima league slugs stored in DB and seed files. v5: Europe's top five. */
export const ULTIMA_LEAGUES = [
  "pl",
  "laliga",
  "seriea",
  "bundesliga",
  "ligue1",
];

export const ULTIMA_LEAGUE_LABELS = {
  pl: "Premier League",
  laliga: "LaLiga",
  seriea: "Serie A",
  bundesliga: "Bundesliga",
  ligue1: "Ligue 1",
};

export const ULTIMA_LEAGUE_SHORT = {
  pl: "PL",
  laliga: "LL",
  seriea: "SA",
  bundesliga: "BL",
  ligue1: "L1",
};

export const ULTIMA_MAX_SEATS = 10;
export const ULTIMA_SQUAD_SIZE = 30;
export const ULTIMA_XI_SIZE = 15;
export const ULTIMA_DRAFT_ROUNDS = 30;
export const ULTIMA_TOTAL_PICKS = ULTIMA_MAX_SEATS * ULTIMA_DRAFT_ROUNDS;
export const ULTIMA_SQUAD_FLOOR_PER_LEAGUE = 3;
export const ULTIMA_XI_FLOOR_PER_LEAGUE = 3;
export const ULTIMA_BOLT_MIN_ROUND = 16;
export const ULTIMA_BOLT_MIN_BASE_POINTS = 6;
export const ULTIMA_TRADE_OPENS_GW = 4;

export const ULTIMA_DRAFT_STATES = [
  "lobby",
  "live",
  "paused",
  "complete",
  "cancelled",
];

export const ULTIMA_TIMER_OPTIONS = [30, 60, 90, 120, 300, 86400];

export const ULTIMA_TIMER_LABELS = {
  30: "30 seconds",
  60: "1 minute",
  90: "90 seconds",
  120: "2 minutes",
  300: "5 minutes",
  86400: "24 hours",
};

export function formatUltimaTimer(seconds) {
  return ULTIMA_TIMER_LABELS[seconds] ?? `${seconds}s`;
}

/** Eight brand-safe colour chips for manager identity (v1). */
export const ULTIMA_COLOUR_PALETTE = [
  { id: "navy", hex: "#0A111F", label: "Navy" },
  { id: "red", hex: "#D8232A", label: "Signal red" },
  { id: "cream", hex: "#E8DFD0", label: "Warm cream" },
  { id: "forest", hex: "#1B4332", label: "Forest" },
  { id: "gold", hex: "#B8860B", label: "Gold" },
  { id: "slate", hex: "#4A5568", label: "Slate" },
  { id: "wine", hex: "#722F37", label: "Wine" },
  { id: "teal", hex: "#0D5C63", label: "Teal" },
];

export const ULTIMA_INVITE_CODE_LENGTH = 8;
export const ULTIMA_INVITE_EXPIRY_DAYS = 14;

/** Sportmonks match-rating bands. Same in every league. */
export const ULTIMA_DEFAULT_RATING_THRESHOLDS = {
  pl: { band1: 7.0, band2: 7.5 },
  laliga: { band1: 7.0, band2: 7.5 },
  seriea: { band1: 7.0, band2: 7.5 },
  bundesliga: { band1: 7.0, band2: 7.5 },
  ligue1: { band1: 7.0, band2: 7.5 },
};

export function leagueLabel(slug) {
  return ULTIMA_LEAGUE_LABELS[slug] ?? slug;
}
