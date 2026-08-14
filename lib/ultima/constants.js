/** Ultima league slugs stored in DB and seed files. */
export const ULTIMA_LEAGUES = ["pl", "laliga", "seriea"];

export const ULTIMA_LEAGUE_LABELS = {
  pl: "Premier League",
  laliga: "LaLiga",
  seriea: "Serie A",
};

export const ULTIMA_LEAGUE_SHORT = {
  pl: "PL",
  laliga: "LL",
  seriea: "SA",
};

export const ULTIMA_MAX_SEATS = 10;
export const ULTIMA_SQUAD_SIZE = 25;
export const ULTIMA_XI_SIZE = 11;
export const ULTIMA_DRAFT_ROUNDS = 25;
export const ULTIMA_SQUAD_FLOOR_PER_LEAGUE = 4;
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

/** Default rating bands before per-league calibration is signed off. */
export const ULTIMA_DEFAULT_RATING_THRESHOLDS = {
  pl: { band1: 7.0, band2: 7.5 },
  laliga: { band1: 7.0, band2: 7.5 },
  seriea: { band1: 7.0, band2: 7.5 },
};
