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

/** Tight chips: football nation tags. Full league names stay in sentences. */
export const ULTIMA_LEAGUE_SHORT = {
  pl: "ENG",
  laliga: "ESP",
  seriea: "ITA",
  bundesliga: "GER",
  ligue1: "FRA",
};

/**
 * Light league fills for the draft board. Kept at an even lightness so no league
 * reads as more important, and all five carry navy text well past AA contrast.
 */
export const ULTIMA_LEAGUE_COLOURS = {
  pl: "#66C19A",
  laliga: "#E8A87C",
  seriea: "#7FB3D5",
  bundesliga: "#D98B94",
  ligue1: "#C7B3E0",
};

export const ULTIMA_MAX_SEATS = 10;
export const ULTIMA_SQUAD_SIZE = 30;
export const ULTIMA_XI_SIZE = 15;
export const ULTIMA_DRAFT_ROUNDS = 30;
export const ULTIMA_TOTAL_PICKS = ULTIMA_MAX_SEATS * ULTIMA_DRAFT_ROUNDS;
export const ULTIMA_SQUAD_FLOOR_PER_LEAGUE = 3;
export const ULTIMA_XI_FLOOR_PER_LEAGUE = 3;
/**
 * Smallest pool that can finish a draft: every seat fills a 30-man squad, and
 * every squad needs its floor from each league.
 */
export const ULTIMA_MIN_POOL_TOTAL = ULTIMA_TOTAL_PICKS;
export const ULTIMA_MIN_POOL_PER_LEAGUE = ULTIMA_MAX_SEATS * ULTIMA_SQUAD_FLOOR_PER_LEAGUE;

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

/** Stored identity colours. Signal red stays for legacy seats only. */
export const ULTIMA_COLOUR_PALETTE = [
  { id: "navy", hex: "#0A111F", label: "Navy" },
  { id: "red", hex: "#D8232A", label: "Signal red" },
  { id: "cream", hex: "#E8DFD0", label: "Warm cream" },
  { id: "forest", hex: "#1B4332", label: "Forest" },
  { id: "gold", hex: "#B8860B", label: "Gold" },
  { id: "slate", hex: "#4A5568", label: "Slate" },
  { id: "wine", hex: "#722F37", label: "Wine" },
  { id: "teal", hex: "#0D5C63", label: "Teal" },
  { id: "sky", hex: "#1D4E89", label: "Sky" },
  { id: "black", hex: "#1C1C1C", label: "Black" },
];

/** Kit picker. Signal red is reserved for LIVE and veto. */
export const ULTIMA_KIT_COLOURS = ULTIMA_COLOUR_PALETTE.filter((chip) => chip.id !== "red");

export function ultimaColourHex(id) {
  return ULTIMA_COLOUR_PALETTE.find((chip) => chip.id === id)?.hex ?? "#4A5568";
}

export const ULTIMA_NOTIFY_PREFS = [
  { id: "draft_on_clock", label: "On the clock" },
  { id: "draft_auto_pick", label: "Auto-pick" },
  { id: "trade_proposed", label: "Trade offers" },
  { id: "xi_reminder", label: "XV reminder" },
  { id: "draft_reminder", label: "Draft reminder" },
];

export function normalizeNotifyPrefs(value) {
  const raw = value && typeof value === "object" ? value : {};
  return Object.fromEntries(
    ULTIMA_NOTIFY_PREFS.map((item) => [item.id, raw[item.id] !== false]),
  );
}

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
