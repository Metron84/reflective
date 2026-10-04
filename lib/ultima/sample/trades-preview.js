import { ULTIMA_LEAGUES } from "@/lib/ultima/constants";
import { sampleRoster } from "@/lib/ultima/sample/squad-preview";

/** SAMPLE-only trade desk. Not live players or managers. Never read in production. */

const METRICS = [
  { goals_rate: 0.55, assists_rate: 0.2, rating_avg: 7.4, minutes_reliability: 0.95 },
  { goals_rate: 0.35, assists_rate: 0.25, rating_avg: 7.2, minutes_reliability: 0.9 },
  { goals_rate: 0.2, assists_rate: 0.3, rating_avg: 7.1, minutes_reliability: 0.85 },
  { goals_rate: 0.1, assists_rate: 0.15, rating_avg: 6.9, minutes_reliability: 0.8 },
];

function dress(list, owner) {
  return list.map((p, i) => ({
    ...p,
    id: `${owner}-${p.id}`,
    club: `SAMPLE Club ${ULTIMA_LEAGUES.indexOf(p.league) + 1}`,
    position: ["FWD", "MID", "DEF", "GK", "MID", "FWD"][i % 6],
    seed_metrics: METRICS[i % METRICS.length],
  }));
}

const CLUBS = [
  { id: "me", team_name: "SAMPLE Dubai Reds", manager_name: "You", colour: "red", yours: true },
  { id: "m2", team_name: "SAMPLE North Bank", manager_name: "Manager Two", colour: "teal" },
  { id: "m3", team_name: "SAMPLE Matchday FC", manager_name: "Manager Three", colour: "amber" },
  { id: "m4", team_name: "SAMPLE Terrace", manager_name: "Manager Four", colour: "blue" },
].map((c, i) => ({ ...c, rank: i + 1, is_bot: false }));

export function sampleTradeOffice({ stage = "open" } = {}) {
  const rosters = Object.fromEntries(CLUBS.map((c) => [c.id, dress(sampleRoster(), c.id)]));
  const mine = rosters.me;
  const pick = (owner, league, n) => rosters[owner].filter((p) => p.league === league)[n];

  const board = {
    mine: {
      [pick("me", "laliga", 0).id]: { stance: "listed", note: "Want a Serie A midfielder back" },
      [pick("me", "bundesliga", 3).id]: { stance: "open", note: "" },
    },
    prefs: { looking_for: ["seriea", "ligue1"], note: "A midfielder who plays every week" },
    sellers: [
      {
        ...CLUBS[1],
        looking_for: ["pl"],
        note: "Open to a swap for a striker",
        asked: false,
        players: [
          { ...pick("m2", "pl", 1), stance: "listed", note: "Looking for a Ligue 1 forward", asked: false },
          { ...pick("m2", "seriea", 4), stance: "open", note: "", asked: true },
        ],
      },
      {
        ...CLUBS[2],
        looking_for: [],
        note: "",
        asked: false,
        players: [{ ...pick("m3", "bundesliga", 0), stance: "open", note: "Will hear offers on him", asked: false }],
      },
    ],
    inbox: [
      {
        id: "i1",
        state: "new",
        createdAt: new Date().toISOString(),
        message: "I can offer a Premier League defender.",
        from: { id: "m4", team_name: CLUBS[3].team_name, manager_name: CLUBS[3].manager_name, colour: "blue" },
        player: pick("me", "laliga", 0),
      },
      {
        id: "i2",
        state: "seen",
        createdAt: new Date().toISOString(),
        message: "",
        from: { id: "m3", team_name: CLUBS[2].team_name, manager_name: CLUBS[2].manager_name, colour: "amber" },
        player: null,
      },
    ],
    asked: [{ to: "m2", player: pick("m2", "seriea", 4).id, state: "new" }],
  };

  const windowOpen = stage === "open";
  return {
    myId: "me",
    windowOpen,
    windowLabel: windowOpen ? "Open" : "Closed",
    windowCloses: windowOpen ? "2d 4h" : null,
    reopenAt: null,
    stats: [
      { label: "Received", value: "0" },
      { label: "Sent", value: "0" },
      { label: "Interest", value: "1" },
      { label: "Window", value: windowOpen ? "Open" : "Closed" },
    ],
    clubs: CLUBS,
    hasSquad: stage !== "nosquad",
    board,
    myRoster: mine,
    rosters,
    received: [],
    sent: [],
    league: [],
    offers: [],
  };
}
