import {
  ULTIMA_BOLT_MIN_BASE_POINTS,
  ULTIMA_BOLT_MIN_ROUND,
  ULTIMA_DEFAULT_RATING_THRESHOLDS,
  ULTIMA_DRAFT_ROUNDS,
  ULTIMA_MAX_SEATS,
  ULTIMA_SQUAD_FLOOR_PER_LEAGUE,
  ULTIMA_SQUAD_SIZE,
  ULTIMA_TIERED_TIMER_TEXT,
  ULTIMA_TOTAL_PICKS,
  ULTIMA_XI_FLOOR_PER_LEAGUE,
  ULTIMA_XI_SIZE,
} from "@/lib/ultima/constants";

const band1 = ULTIMA_DEFAULT_RATING_THRESHOLDS.pl.band1.toFixed(1);
const band2 = ULTIMA_DEFAULT_RATING_THRESHOLDS.pl.band2.toFixed(1);

export const RULES_ANCHORS = [
  { id: "scoring", label: "Scoring" },
  { id: "floor", label: "Floor" },
  { id: "bolt", label: "Bolt" },
  { id: "draft", label: "Draft" },
  { id: "trade", label: "Trade window" },
];

export const RULES_SCORING_ROWS = [
  { event: "Goal", points: "3" },
  { event: "Assist", points: "1" },
  { event: `Match rating ${band1} to 7.4`, points: "1" },
  { event: `Match rating ${band2} and above`, points: "2" },
  {
    event: `Bolt bonus (round ${ULTIMA_BOLT_MIN_ROUND}+ or undrafted FA, ${ULTIMA_BOLT_MIN_BASE_POINTS}+ base in a GW)`,
    points: "+2",
  },
];

export const RULES_OFFICE_SCORING = [
  { label: "Goal", value: "3" },
  { label: "Assist", value: "1" },
  { label: `Rating ${band1} to 7.4 =`, value: "1" },
  { label: `Rating ${band2}+ =`, value: "2" },
];

export const RULES_BOLT = `+${2} when a player scores ${ULTIMA_BOLT_MIN_BASE_POINTS}+ base and is eligible.`;

export const RULES_ACCESS = `Invite only. Ten seats. Sign in, then enter the invite password at /ultima/join.`;

export const RULES_DRAFT = [
  `Live snake draft, ${ULTIMA_DRAFT_ROUNDS} rounds, ${ULTIMA_TOTAL_PICKS} picks across ${ULTIMA_MAX_SEATS} managers.`,
  `Minimum ${ULTIMA_SQUAD_FLOOR_PER_LEAGUE} players from each league by the end of the draft.`,
  "Timer auto-picks from your queue if it expires.",
  "Turn on auto-draft to let the board pick for you from your queue, then ranking.",
  `Pick clock: ${ULTIMA_TIERED_TIMER_TEXT}. Managers on auto-draft pick at once.`,
  "If a manager is away, the commissioner can force-pick for the seat on the clock.",
  "Practise first at /ultima/practice. Solo vs bots, or a shared room. Practice picks do not count.",
];

export const RULES_TRADE = [
  "Free agency opens when the draft completes. Every add requires a drop.",
  "Trades are open now. Equal player counts. 24 hour league review, and the other managers can veto.",
  "Three live offers at a time. An offer nobody answers expires after 48 hours.",
  "Once an offer is accepted its players are frozen. After that nobody can back out.",
];

export const RULES_FLOOR = [
  `${ULTIMA_SQUAD_SIZE}-man squad. Minimum ${ULTIMA_SQUAD_FLOOR_PER_LEAGUE} players from each of the five leagues.`,
  `Starting XV of ${ULTIMA_XI_SIZE}. Exactly ${ULTIMA_XI_FLOOR_PER_LEAGUE} from each league. All fifteen score.`,
  "Bench players score zero.",
  "One captain per country, five a week. A captain scores double. Set captains on the Squad page.",
  "If a captain leaves the XV, that country has no captain. No pick in a new week carries last week's captain if he is still in the XV.",
];

export const RULES_LOCKING =
  "Each league locks at its first kickoff inside the gameweek window (Friday 00:00 to Thursday 23:59 GST). A slot locks when the league of the player in it opens, and so does that country's captain.";

export const RULES_LEAGUES =
  "Premier League, LaLiga, Serie A, Bundesliga, and Ligue 1. Invite only. Ten seats. Thirty draft rounds.";

export const RULES_NOTE = `Match ratings come from Sportmonks. The bands are ${band1} and ${band2} in every league.`;
