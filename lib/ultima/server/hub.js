import { ULTIMA_SQUAD_SIZE, ULTIMA_XI_SIZE } from "@/lib/ultima/constants";
import { isFinishedStatus, isLiveStatus } from "@/lib/ultima/fixture-status";
import { filledXiCount } from "@/lib/ultima/lineup/slots";
import { getHubStatus } from "@/lib/ultima/server/admin";
import { getCurrentGameweek } from "@/lib/ultima/server/bootstrap";
import { listChatMessages } from "@/lib/ultima/server/chat";
import { getUltimaDb } from "@/lib/ultima/server/db";
import {
  getEuropeDesk,
  kickEuropeSync,
  shouldRefreshEuropeForm,
} from "@/lib/ultima/server/europe-board";
import { getLineup, getManagerRoster } from "@/lib/ultima/server/lineup";
import { getCompetitionNews } from "@/lib/ultima/server/news";
import { safeResolve } from "@/lib/ultima/server/safe";
import { getStandings } from "@/lib/ultima/server/scoring-run";
import { listHubTradeCards } from "@/lib/ultima/server/trades";
import { listWatchlistScoutReports } from "@/lib/ultima/server/watchlist";

const DUBAI = "Asia/Dubai";
const INBOX_PREVIEW = 5;
const SCOUT_DAYS = 7;

function clubKey(name) {
  return String(name ?? "").trim().toLowerCase();
}

function hasBothScores(row) {
  return row?.homeScore != null && row?.awayScore != null;
}

function formatInboxTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: DUBAI,
  });
}

function dubaiDateKey(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DUBAI,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function formatDateHead(iso) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: DUBAI,
  }).format(new Date(iso));
}

function countdownTo(ms) {
  const left = ms - Date.now();
  if (!Number.isFinite(left) || left <= 0) return null;
  const days = Math.floor(left / 86_400_000);
  const hours = Math.floor((left % 86_400_000) / 3_600_000);
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((left % 3_600_000) / 60_000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${Math.max(1, minutes)}m`;
}

function nextLockLabel(gameweek) {
  const opens = gameweek?.league_open_at;
  if (!opens || typeof opens !== "object") return null;
  const times = Object.values(opens)
    .map((value) => new Date(value).getTime())
    .filter((t) => Number.isFinite(t) && t > Date.now())
    .sort((a, b) => a - b);
  if (!times.length) return null;
  return countdownTo(times[0]);
}

function parseDelta(stat) {
  if (stat == null || stat === "" || stat === "minutes") return null;
  const n = Number(String(stat).replace(/^\+/, ""));
  return Number.isFinite(n) ? n : null;
}

function emptyDesk() {
  return {
    fixtures: [],
    form: { teams: { hot: [], cold: [], all: [] }, players: [] },
    movers: { rising: [], falling: [] },
    emptyReason: "sync",
  };
}

function buildBriefing({ draftState, hubStatus, tradeCards }) {
  const items = [];

  if (hubStatus?.draft === "live" || draftState === "live") {
    items.push({
      id: "brief-draft",
      subject: "The draft is live. The clock is running.",
      href: "/ultima/draft",
    });
  } else if (draftState === "paused") {
    items.push({
      id: "brief-paused",
      subject: "The commissioner paused the draft.",
      href: "/ultima/draft",
    });
  }

  const veto = (tradeCards ?? []).find((c) => c.can_veto && !c.already_vetoed);
  if (veto) {
    items.push({
      id: `brief-veto-${veto.id}`,
      subject: `${veto.proposer_name} to ${veto.receiver_name} is in league review.`,
      href: "#ultima-trades",
    });
  }

  const accept = (tradeCards ?? []).find((c) => c.can_accept);
  if (accept) {
    items.push({
      id: `brief-accept-${accept.id}`,
      subject: `${accept.proposer_name} sent you a trade.`,
      href: "#ultima-trades",
    });
  }

  return items;
}

function buildInbox({ news, briefing, fixtures, scoutReports, managerId }) {
  const items = [];
  const now = new Date().toISOString();

  for (const item of briefing ?? []) {
    items.push({
      id: item.id,
      type: "staff",
      subject: item.subject,
      sender: "Staff",
      time: "Now",
      at: now,
      href: item.href ?? null,
      unread: true,
    });
  }

  for (const item of scoutReports ?? []) {
    items.push({
      id: item.id,
      type: "scout",
      subject: item.subject,
      sender: "Scout",
      time: formatInboxTime(item.at),
      at: item.at,
      href: "/ultima/market",
      unread: true,
    });
  }

  for (const item of news ?? []) {
    const trade = String(item.event ?? "").startsWith("trade");
    if (trade && item.forManagerIds && !item.forManagerIds.includes(managerId) && !item.leagueMail) {
      continue;
    }
    const seat = item.event === "invite_redeemed";
    const personal = trade && !item.leagueMail;
    items.push({
      id: `news-${item.id}`,
      type: trade ? "trade" : "league",
      subject: item.line,
      sender: seat ? "Seat" : personal ? "Trade desk" : "League mail",
      time: formatInboxTime(item.at),
      at: item.at,
      href: item.href ?? (personal ? "/ultima/trades" : null),
      unread: personal,
    });
  }

  for (const row of fixtures ?? []) {
    if (!isFinishedStatus(row.status) || !hasBothScores(row)) continue;
    items.push({
      id: `result-${row.id}`,
      type: "board",
      subject: `${row.home} ${row.homeScore}-${row.awayScore} ${row.away}`,
      sender: row.leagueCode || "Board",
      time: formatInboxTime(row.kickoff),
      at: row.kickoff,
      href: null,
      unread: false,
    });
  }

  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return {
    preview: items.slice(0, INBOX_PREVIEW),
    rest: items.slice(INBOX_PREVIEW),
  };
}

function pickNextMatch(fixtures, yourClubs) {
  if (!yourClubs.size) return null;
  const yours = (fixtures ?? []).filter(
    (row) => yourClubs.has(clubKey(row.home)) || yourClubs.has(clubKey(row.away)),
  );
  const live = yours.find((row) => isLiveStatus(row.status));
  if (live) return live;
  const now = Date.now() - 3 * 60 * 60 * 1000;
  return [...yours]
    .filter((row) => row.status === "NS" || row.status === "POSTP")
    .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff))
    .find((row) => new Date(row.kickoff).getTime() >= now) ?? null;
}

function buildScouting(fixtures, yourClubs) {
  const now = Date.now();
  const horizon = now + SCOUT_DAYS * 86_400_000;
  const upcoming = (fixtures ?? []).filter((row) => {
    if (isFinishedStatus(row.status)) return false;
    if (isLiveStatus(row.status)) return true;
    const t = new Date(row.kickoff).getTime();
    return Number.isFinite(t) && t >= now - 3 * 60 * 60 * 1000 && t <= horizon;
  });

  const groups = [];
  const byDay = new Map();
  for (const row of upcoming) {
    const key = dubaiDateKey(row.kickoff);
    if (!key) continue;
    if (!byDay.has(key)) {
      const group = {
        key,
        label: formatDateHead(row.kickoff),
        rows: [],
      };
      byDay.set(key, group);
      groups.push(group);
    }
    byDay.get(key).rows.push({
      id: row.id,
      home: row.home,
      away: row.away,
      kickoff: row.kickoff,
      league: row.league,
      leagueCode: row.leagueCode,
      status: row.status,
      live: isLiveStatus(row.status),
      homeScore: hasBothScores(row) ? row.homeScore : null,
      awayScore: hasBothScores(row) ? row.awayScore : null,
      yours: yourClubs.has(clubKey(row.home)) || yourClubs.has(clubKey(row.away)),
    });
  }
  return groups;
}

function mapMatch(row) {
  if (!row) return null;
  const live = isLiveStatus(row.status);
  return {
    id: row.id,
    home: row.home,
    away: row.away,
    kickoff: row.kickoff,
    league: row.league,
    leagueCode: row.leagueCode,
    status: row.status,
    live,
    homeScore: hasBothScores(row) ? row.homeScore : null,
    awayScore: hasBothScores(row) ? row.awayScore : null,
  };
}

function mapMovers(list, direction) {
  return (list ?? [])
    .map((row) => {
      const delta = row.ratingDelta ?? parseDelta(row.stat);
      if (delta == null) return null;
      if (direction === "up" && delta <= 0) return null;
      if (direction === "down" && delta >= 0) return null;
      return {
        playerId: row.playerId,
        name: row.name,
        club: row.club,
        leagueCode: row.leagueCode,
        delta,
      };
    })
    .filter(Boolean);
}

function mapTable(standings, managerId) {
  const rows = standings ?? [];
  const you = rows.find((row) => row.id === managerId) ?? null;
  const top4 = rows.slice(0, 4).map((row) => ({
    id: row.id,
    rank: row.rank,
    team_name: row.team_name,
    seasonPoints: row.seasonPoints,
    yours: row.id === managerId,
  }));
  const youOutside =
    you && you.rank > 4
      ? {
          id: you.id,
          rank: you.rank,
          team_name: you.team_name,
          seasonPoints: you.seasonPoints,
          yours: true,
        }
      : null;
  return { top4, youOutside };
}

export function emptyHubOffice(managerId) {
  return {
    stats: [
      { label: "Squad filled", value: "-" },
      { label: "League position", value: "-" },
      { label: "Season points", value: "-" },
      { label: "Next lock", value: "-" },
    ],
    trades: [],
    inbox: { preview: [], rest: [] },
    nextMatch: null,
    hasRoster: false,
    scouting: [],
    form: { teams: [], players: [] },
    movers: { rising: [], falling: [] },
    table: { top4: [], youOutside: null },
    chat: [],
    managerId: managerId ?? null,
  };
}

function assembleHubOffice({
  managerId,
  gameweek,
  status,
  news,
  cards,
  desk,
  ds,
  roster,
  standings,
  chat,
  scoutReports,
  lineup,
}) {
  const europe = desk ?? emptyDesk();

  const draftState = ds?.state ?? status?.draft ?? "lobby";
  const you = (standings ?? []).find((row) => row.id === managerId) ?? null;
  const xiFilled = gameweek?.id ? filledXiCount(lineup) : null;
  const rosterCount = (roster ?? []).length;
  const yourClubs = new Set(
    (roster ?? []).map((player) => clubKey(player.club)).filter(Boolean),
  );

  let squadFilled = "-";
  if (gameweek?.id) {
    squadFilled = `${xiFilled}/${ULTIMA_XI_SIZE}`;
  } else if (rosterCount > 0) {
    squadFilled = `${rosterCount}/${ULTIMA_SQUAD_SIZE}`;
  }

  const briefing = buildBriefing({
    draftState,
    hubStatus: status,
    tradeCards: cards,
  });
  if ((news ?? []).some((item) => item.event === "invite_redeemed" && item.managerId === managerId)) {
    briefing.unshift({
      id: "brief-welcome",
      subject: "Welcome to the office. Your seat is confirmed.",
      href: "/ultima/rules",
    });
  }

  return {
    stats: [
      { label: "Squad filled", value: squadFilled },
      { label: "League position", value: you?.rank != null ? String(you.rank) : "-" },
      {
        label: "Season points",
        value: you ? String(you.seasonPoints ?? 0) : "-",
      },
      { label: "Next lock", value: nextLockLabel(gameweek) ?? "-" },
    ],
    trades: cards ?? [],
    inbox: buildInbox({
      news,
      briefing,
      fixtures: europe.fixtures,
      scoutReports,
      managerId,
    }),
    nextMatch: mapMatch(pickNextMatch(europe.fixtures, yourClubs)),
    hasRoster: rosterCount > 0,
    scouting: buildScouting(europe.fixtures, yourClubs),
    form: {
      teams: (europe.form?.teams?.all ?? []).map((row) => ({
        clubId: row.clubId,
        club: row.club,
        league: row.league,
        last5: row.last5 ?? [],
        heat: row.heat,
      })),
      players: (europe.form?.players ?? []).map((row) => ({
        playerId: row.playerId,
        name: row.name,
        club: row.club,
        league: row.league,
        rating: row.last3?.rating ?? null,
      })),
    },
    movers: {
      rising: mapMovers(europe.movers?.rising, "up"),
      falling: mapMovers(europe.movers?.falling, "down"),
    },
    table: mapTable(standings, managerId),
    chat: (chat ?? []).map((msg) => ({
      id: msg.id,
      body: msg.body,
      at: msg.at,
      manager_id: msg.manager_id,
      team_name: msg.team_name,
    })),
    managerId,
  };
}

export async function getHubOffice({ competitionId, managerId }) {
  if (!competitionId || !managerId) return null;

  try {
    const db = getUltimaDb();
    const [
      gameweek,
      status,
      news,
      cards,
      desk,
      ds,
      roster,
      standings,
      chat,
      scoutReports,
    ] = await Promise.all([
      safeResolve(getCurrentGameweek(competitionId), null),
      safeResolve(getHubStatus(competitionId, managerId), null),
      safeResolve(getCompetitionNews(competitionId), []),
      safeResolve(listHubTradeCards(competitionId, managerId), []),
      safeResolve(getEuropeDesk(competitionId), emptyDesk()),
      db
        ? safeResolve(
            db
              .from("ultima_draft_state")
              .select("state")
              .eq("competition_id", competitionId)
              .maybeSingle()
              .then(({ data }) => data),
            null,
          )
        : Promise.resolve(null),
      safeResolve(getManagerRoster(managerId), []),
      safeResolve(getStandings(competitionId), []),
      safeResolve(listChatMessages(competitionId), []),
      safeResolve(listWatchlistScoutReports(managerId), []),
    ]);

    const lineup = gameweek?.id
      ? await safeResolve(getLineup(managerId, gameweek.id), [])
      : [];

    const europe = desk ?? emptyDesk();
    if (shouldRefreshEuropeForm(europe)) {
      kickEuropeSync(competitionId);
    }

    return assembleHubOffice({
      managerId,
      gameweek,
      status,
      news,
      cards,
      desk: europe,
      ds,
      roster,
      standings,
      chat,
      scoutReports,
      lineup,
    });
  } catch {
    return emptyHubOffice(managerId);
  }
}
