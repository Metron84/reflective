import {
  ULTIMA_LEAGUES,
  ULTIMA_LEAGUE_SHORT,
  ULTIMA_SQUAD_FLOOR_PER_LEAGUE,
  ULTIMA_TRADE_OPENS_GW,
} from "@/lib/ultima/constants";
import { validateTradeFairness } from "@/lib/ultima/trades/validator";
import { getCurrentGameweek } from "@/lib/ultima/server/bootstrap";
import { getUltimaDb } from "@/lib/ultima/server/db";
import { publishUltimaEvent } from "@/lib/ultima/server/events";
import { getManagerRoster, squadLeagueCounts } from "@/lib/ultima/server/lineup";
import { notifyTradeProposedAsync } from "@/lib/ultima/server/notify";
import { recordUltimaEvent } from "@/lib/ultima/server/record-event";
import { getStandings } from "@/lib/ultima/server/scoring-run";

const REVIEW_HOURS = 24;

function playerTradeMetrics(player) {
  const m = player.seed_metrics ?? {};
  return {
    ppg: (m.goals_rate ?? 0) * 3 + (m.assists_rate ?? 0) + (m.rating_avg ?? 0) * 0.3,
    fixturesRemaining: 20,
    minutesReliability: m.minutes_reliability ?? 0.8,
    boltExpectation: player.bolt_eligible ? 0.5 : 0,
  };
}

export async function validateTradeProposal({
  proposerId,
  receiverId,
  givePlayerIds,
  getPlayerIds,
  gameweekNumber,
}) {
  if (gameweekNumber < ULTIMA_TRADE_OPENS_GW) {
    return { ok: false, code: "TRADE_TOO_EARLY" };
  }

  if (givePlayerIds.length !== getPlayerIds.length) {
    return { ok: false, code: "TRADE_UNEVEN" };
  }

  const db = getUltimaDb();
  const proposerRoster = await getManagerRoster(proposerId);
  const receiverRoster = await getManagerRoster(receiverId);

  for (const id of givePlayerIds) {
    if (!proposerRoster.find((p) => p.id === id)) {
      return { ok: false, code: "FLOOR_VIOLATION", message: "A player you give is not on your squad." };
    }
  }
  for (const id of getPlayerIds) {
    if (!receiverRoster.find((p) => p.id === id)) {
      return { ok: false, code: "FLOOR_VIOLATION", message: "A player you want is not on their squad." };
    }
  }

  const givePlayers = proposerRoster.filter((p) => givePlayerIds.includes(p.id));
  const getPlayers = receiverRoster.filter((p) => getPlayerIds.includes(p.id));

  const giveMetrics = givePlayers.map(playerTradeMetrics);
  const getMetrics = getPlayers.map(playerTradeMetrics);
  const verdict = validateTradeFairness(giveMetrics, getMetrics, gameweekNumber);

  // Floor check after trade
  const afterProposer = proposerRoster.filter((p) => !givePlayerIds.includes(p.id)).concat(getPlayers);
  const afterReceiver = receiverRoster.filter((p) => !getPlayerIds.includes(p.id)).concat(givePlayers);

  for (const [label, roster] of [
    ["Your", afterProposer],
    ["Their", afterReceiver],
  ]) {
    const counts = squadLeagueCounts(roster);
    for (const league of ULTIMA_LEAGUES) {
      if (counts[league] < ULTIMA_SQUAD_FLOOR_PER_LEAGUE) {
        return {
          ok: false,
          code: "FLOOR_VIOLATION",
          message: `${label} squad would break the league floor.`,
        };
      }
    }
  }

  return { ok: true, verdict, givePlayers, getPlayers };
}

export async function proposeTrade({
  competitionId,
  proposerId,
  receiverId,
  givePlayerIds,
  getPlayerIds,
  gameweekNumber,
}) {
  const check = await validateTradeProposal({
    proposerId,
    receiverId,
    givePlayerIds,
    getPlayerIds,
    gameweekNumber,
  });
  if (!check.ok) return check;

  const db = getUltimaDb();
  const { data: trade, error } = await db
    .from("ultima_trades")
    .insert({
      competition_id: competitionId,
      proposer_id: proposerId,
      receiver_id: receiverId,
      state: "proposed",
      verdict_json: check.verdict,
    })
    .select("id")
    .single();

  if (error || !trade) return { ok: false, code: "UNAVAILABLE" };

  const rows = [];
  for (const pid of givePlayerIds) {
    rows.push({
      trade_id: trade.id,
      player_id: pid,
      from_manager_id: proposerId,
      to_manager_id: receiverId,
    });
  }
  for (const pid of getPlayerIds) {
    rows.push({
      trade_id: trade.id,
      player_id: pid,
      from_manager_id: receiverId,
      to_manager_id: proposerId,
    });
  }
  await db.from("ultima_trade_players").insert(rows);

  await recordUltimaEvent({
    event: "trade_proposed",
    managerId: proposerId,
    competitionId: trade.competition_id,
    payload: { trade_id: trade.id },
  });

  publishUltimaEvent("trade.state", { trade_id: trade.id, state: "proposed" });

  const { data: proposer } = await db
    .from("ultima_managers")
    .select("team_name")
    .eq("id", proposerId)
    .maybeSingle();

  notifyTradeProposedAsync({
    receiverId,
    tradeId: trade.id,
    proposerTeam: proposer?.team_name,
  });

  return { ok: true, tradeId: trade.id, verdict: check.verdict };
}

export async function respondToTrade({ tradeId, managerId, accept }) {
  const db = getUltimaDb();
  const { data: trade } = await db
    .from("ultima_trades")
    .select("*")
    .eq("id", tradeId)
    .maybeSingle();

  if (!trade || trade.receiver_id !== managerId) {
    return { ok: false, code: "UNAVAILABLE" };
  }
  if (trade.state !== "proposed") {
    return { ok: false, code: "UNAVAILABLE", message: "That trade is no longer open." };
  }

  if (!accept) {
    await db.from("ultima_trades").update({ state: "declined", resolved_at: new Date().toISOString() }).eq("id", tradeId);
    await recordUltimaEvent({
      event: "trade_declined",
      managerId,
      competitionId: trade.competition_id,
      payload: { trade_id: tradeId },
    });
    publishUltimaEvent("trade.state", { trade_id: tradeId, state: "declined" });
    return { ok: true, state: "declined" };
  }

  const reviewExpires = new Date(Date.now() + REVIEW_HOURS * 3600_000).toISOString();
  await db
    .from("ultima_trades")
    .update({ state: "review", review_expires_at: reviewExpires })
    .eq("id", tradeId);

  await recordUltimaEvent({
    event: "trade_review",
    managerId,
    competitionId: trade.competition_id,
    payload: { trade_id: tradeId },
  });
  publishUltimaEvent("trade.state", { trade_id: tradeId, state: "review" });
  return { ok: true, state: "review", reviewExpires };
}

export async function vetoTrade({ tradeId, managerId }) {
  const db = getUltimaDb();
  const { data: trade } = await db.from("ultima_trades").select("*").eq("id", tradeId).maybeSingle();
  if (!trade || trade.state !== "review") {
    return { ok: false, code: "UNAVAILABLE" };
  }
  if (trade.proposer_id === managerId || trade.receiver_id === managerId) {
    return { ok: false, code: "UNAVAILABLE", message: "Trade parties cannot veto." };
  }

  await db.from("ultima_trade_votes").upsert(
    { trade_id: tradeId, manager_id: managerId, veto: true },
    { onConflict: "trade_id,manager_id" },
  );

  const { data: managers } = await db
    .from("ultima_managers")
    .select("id, is_bot")
    .eq("competition_id", trade.competition_id);

  const humanOthers = (managers ?? []).filter(
    (m) => !m.is_bot && m.id !== trade.proposer_id && m.id !== trade.receiver_id,
  );

  const { count: vetoCount } = await db
    .from("ultima_trade_votes")
    .select("id", { count: "exact", head: true })
    .eq("trade_id", tradeId)
    .eq("veto", true);

  const majority = Math.floor(humanOthers.length / 2) + 1;
  if ((vetoCount ?? 0) >= majority) {
    await db
      .from("ultima_trades")
      .update({ state: "vetoed", resolved_at: new Date().toISOString() })
      .eq("id", tradeId);
    await recordUltimaEvent({
      event: "trade_vetoed",
      managerId,
      competitionId: trade.competition_id,
      payload: { trade_id: tradeId },
    });
    publishUltimaEvent("trade.state", { trade_id: tradeId, state: "vetoed" });
    return { ok: true, vetoed: true };
  }

  await recordUltimaEvent({
    event: "trade_veto",
    managerId,
    competitionId: trade.competition_id,
    payload: { trade_id: tradeId, votes: vetoCount },
  });
  publishUltimaEvent("trade.state", { trade_id: tradeId, state: "review", votes: vetoCount });
  return { ok: true, vetoed: false };
}

export async function executeTrade(tradeId) {
  const db = getUltimaDb();
  const { data: trade } = await db.from("ultima_trades").select("*").eq("id", tradeId).maybeSingle();
  if (!trade || trade.state !== "review") return { ok: false };

  const { data: players } = await db
    .from("ultima_trade_players")
    .select("*")
    .eq("trade_id", tradeId);

  for (const row of players ?? []) {
    await db.from("ultima_rosters").delete().eq("manager_id", row.from_manager_id).eq("player_id", row.player_id);
    await db.from("ultima_rosters").insert({
      competition_id: trade.competition_id,
      manager_id: row.to_manager_id,
      player_id: row.player_id,
    });
  }

  await db
    .from("ultima_trades")
    .update({ state: "executed", resolved_at: new Date().toISOString() })
    .eq("id", tradeId);

  await recordUltimaEvent({
    event: "trade_executed",
    competitionId: trade.competition_id,
    payload: { trade_id: tradeId },
  });

  publishUltimaEvent("trade.state", { trade_id: tradeId, state: "executed" });
  return { ok: true };
}

export async function expireTradeReviews() {
  const db = getUltimaDb();
  if (!db) return { ok: false };

  const { data: pending } = await db
    .from("ultima_trades")
    .select("id")
    .eq("state", "review")
    .lt("review_expires_at", new Date().toISOString());

  for (const t of pending ?? []) {
    await executeTrade(t.id);
  }

  return { ok: true, executed: pending?.length ?? 0 };
}

export async function listTrades(competitionId, managerId) {
  const db = getUltimaDb();
  const { data } = await db
    .from("ultima_trades")
    .select("*, ultima_trade_players(*, ultima_players(name, league, club))")
    .eq("competition_id", competitionId)
    .or(`proposer_id.eq.${managerId},receiver_id.eq.${managerId}`)
    .order("created_at", { ascending: false });

  return data ?? [];
}

function playerNamesFrom(trade, fromManagerId) {
  return (trade.ultima_trade_players ?? [])
    .filter((row) => row.from_manager_id === fromManagerId)
    .map((row) => row.ultima_players?.name)
    .filter(Boolean);
}

export async function listHubTradeCards(competitionId, managerId) {
  const db = getUltimaDb();
  if (!db || !competitionId || !managerId) return [];

  const { data: trades } = await db
    .from("ultima_trades")
    .select("*, ultima_trade_players(*, ultima_players(name, league, club))")
    .eq("competition_id", competitionId)
    .in("state", ["proposed", "review"])
    .order("created_at", { ascending: false });

  const open = (trades ?? []).filter((trade) => {
    if (trade.state === "proposed") return trade.receiver_id === managerId;
    return true;
  });

  if (!open.length) return [];

  const managerIds = [
    ...new Set(open.flatMap((t) => [t.proposer_id, t.receiver_id])),
  ];
  const { data: managers } = await db
    .from("ultima_managers")
    .select("id, team_name")
    .in("id", managerIds);
  const names = Object.fromEntries((managers ?? []).map((m) => [m.id, m.team_name]));

  const ids = open.map((t) => t.id);
  const { data: votes } = await db
    .from("ultima_trade_votes")
    .select("trade_id, manager_id, veto")
    .in("trade_id", ids);

  return open.map((trade) => {
    const vetoes = (votes ?? []).filter((v) => v.trade_id === trade.id && v.veto);
    const isParty = trade.proposer_id === managerId || trade.receiver_id === managerId;
    return {
      id: trade.id,
      state: trade.state,
      verdict: trade.verdict_json?.message ?? "",
      review_expires_at: trade.review_expires_at,
      proposer_id: trade.proposer_id,
      receiver_id: trade.receiver_id,
      proposer_name: names[trade.proposer_id] ?? "A manager",
      receiver_name: names[trade.receiver_id] ?? "A manager",
      giving: playerNamesFrom(trade, trade.proposer_id),
      getting: playerNamesFrom(trade, trade.receiver_id),
      can_accept: trade.state === "proposed" && trade.receiver_id === managerId,
      can_veto: trade.state === "review" && !isParty,
      already_vetoed: vetoes.some((v) => v.manager_id === managerId),
      veto_count: vetoes.length,
    };
  });
}

export async function previewTradeVerdict({ proposerId, receiverId, givePlayerIds, getPlayerIds, gameweekNumber }) {
  const check = await validateTradeProposal({
    proposerId,
    receiverId,
    givePlayerIds,
    getPlayerIds,
    gameweekNumber,
  });
  if (!check.ok) return check;
  return { ok: true, verdict: check.verdict };
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

function slimPlayer(player) {
  if (!player) return null;
  return {
    id: player.id,
    name: player.name,
    club: player.club,
    league: player.league,
    position: player.position ?? null,
    bolt_eligible: Boolean(player.bolt_eligible),
    seed_metrics: player.seed_metrics ?? {},
  };
}

function chipFor(state) {
  if (state === "proposed") return "Pending";
  if (state === "review") return "In veto";
  if (state === "declined" || state === "vetoed") return "Declined";
  if (state === "expired") return "Expired";
  if (state === "executed" || state === "accepted") return "Accepted";
  return state ?? "-";
}

function countriesFrom(players) {
  const set = new Set((players ?? []).map((p) => p.league).filter(Boolean));
  return ULTIMA_LEAGUES.filter((league) => set.has(league));
}

function mapOffer(trade, myId, clubById, votes) {
  const raw = (trade.ultima_trade_players ?? [])
    .map((row) => ({
      from: row.from_manager_id,
      to: row.to_manager_id,
      player: slimPlayer(row.ultima_players),
    }))
    .filter((row) => row.player);

  const youGive = raw.filter((row) => row.from === myId).map((row) => row.player);
  const youGet = raw.filter((row) => row.to === myId).map((row) => row.player);
  const proposerGive = raw.filter((row) => row.from === trade.proposer_id).map((row) => row.player);
  const receiverGive = raw.filter((row) => row.from === trade.receiver_id).map((row) => row.player);
  const party = trade.proposer_id === myId || trade.receiver_id === myId;
  const give = party ? youGive : proposerGive;
  const get = party ? youGet : receiverGive;
  const all = [...give, ...get];
  const countries = countriesFrom(all);
  const count = Math.max(give.length, get.length);
  const otherId = trade.proposer_id === myId ? trade.receiver_id : trade.proposer_id;
  const other = clubById.get(otherId) ?? clubById.get(trade.proposer_id);
  const proposer = clubById.get(trade.proposer_id);
  const receiver = clubById.get(trade.receiver_id);
  const vetoes = (votes ?? []).filter((v) => v.trade_id === trade.id && v.veto);
  const isParty = party;

  return {
    id: trade.id,
    state: trade.state,
    chip: chipFor(trade.state),
    unread: trade.state === "proposed" && trade.receiver_id === myId,
    createdAt: trade.created_at,
    reviewExpiresAt: trade.review_expires_at ?? null,
    vetoCountdown: trade.review_expires_at
      ? countdownTo(new Date(trade.review_expires_at).getTime())
      : null,
    proposerId: trade.proposer_id,
    receiverId: trade.receiver_id,
    party: isParty,
    other: other
      ? {
          id: other.id,
          team_name: other.team_name,
          manager_name: other.manager_name,
          colour: other.colour,
        }
      : { id: otherId, team_name: "A club", manager_name: "-", colour: "slate" },
    proposer: proposer
      ? { id: proposer.id, team_name: proposer.team_name, colour: proposer.colour }
      : null,
    receiver: receiver
      ? { id: receiver.id, team_name: receiver.team_name, colour: receiver.colour }
      : null,
    youGive: give,
    youGet: get,
    count,
    countries,
    summary: `${count} for ${count}${
      countries.length ? ` · ${countries.map((l) => ULTIMA_LEAGUE_SHORT[l]).join(", ")}` : ""
    }`,
    canAccept: trade.state === "proposed" && trade.receiver_id === myId,
    canDecline: trade.state === "proposed" && trade.receiver_id === myId,
    canCounter: trade.state === "proposed" && trade.receiver_id === myId,
    canVeto: trade.state === "review" && !isParty,
    alreadyVetoed: vetoes.some((v) => v.manager_id === myId),
  };
}

export async function getTradeOffice({ competitionId, managerId }) {
  const db = getUltimaDb();
  if (!db || !competitionId || !managerId) return null;

  const [gameweek, standings, { data: managers }, { data: trades }, { data: gwFour }] = await Promise.all([
    getCurrentGameweek(competitionId),
    getStandings(competitionId),
    db
      .from("ultima_managers")
      .select("id, team_name, manager_name, colour, is_bot, persona_id")
      .eq("competition_id", competitionId),
    db
      .from("ultima_trades")
      .select(
        "*, ultima_trade_players(*, ultima_players(id, name, league, club, position, bolt_eligible, seed_metrics))",
      )
      .eq("competition_id", competitionId)
      .order("created_at", { ascending: false }),
    db
      .from("ultima_gameweeks")
      .select("window_start, window_end, number")
      .eq("competition_id", competitionId)
      .eq("number", ULTIMA_TRADE_OPENS_GW)
      .maybeSingle()
      .then(({ data }) => ({ data })),
  ]);

  const { data: personas } = await db.from("ultima_bot_personas").select("id, name");
  const personaById = new Map((personas ?? []).map((p) => [p.id, p.name]));

  const rankById = new Map((standings ?? []).map((row) => [row.id, row.rank]));
  const clubs = (managers ?? [])
    .map((m) => ({
      id: m.id,
      team_name: m.team_name,
      manager_name: m.is_bot ? personaById.get(m.persona_id) ?? "BOT" : m.manager_name,
      colour: m.colour,
      is_bot: Boolean(m.is_bot),
      yours: m.id === managerId,
      rank: rankById.get(m.id) ?? 99,
    }))
    .sort((a, b) => a.rank - b.rank);
  const clubById = new Map(clubs.map((c) => [c.id, c]));

  const ids = (trades ?? []).map((t) => t.id);
  const { data: votes } = ids.length
    ? await db.from("ultima_trade_votes").select("trade_id, manager_id, veto").in("trade_id", ids)
    : { data: [] };

  const offers = (trades ?? []).map((trade) => mapOffer(trade, managerId, clubById, votes));

  const humanIds = clubs.filter((c) => !c.is_bot).map((c) => c.id);
  const rosterEntries = await Promise.all(
    humanIds.map(async (id) => [id, (await getManagerRoster(id)).map(slimPlayer)]),
  );
  const rosters = Object.fromEntries(rosterEntries);

  const gwNumber = gameweek?.number ?? 0;
  const early = gwNumber < ULTIMA_TRADE_OPENS_GW;
  const gwShut = gameweek?.state === "live" || gameweek?.state === "provisional";
  const windowOpen = !early && !gwShut;
  const opens = gameweek?.league_open_at;
  const nextClose = opens && typeof opens === "object"
    ? Object.values(opens)
        .map((value) => new Date(value).getTime())
        .filter((t) => Number.isFinite(t) && t > Date.now())
        .sort((a, b) => a - b)[0]
    : null;
  const reopenAt = early
    ? gwFour?.window_start ?? null
    : gwShut
      ? gameweek?.window_end ?? null
      : null;
  const windowCloses = windowOpen && nextClose ? countdownTo(nextClose) : null;

  const received = offers.filter((o) => o.receiverId === managerId);
  const sent = offers.filter((o) => o.proposerId === managerId);
  const league = offers.filter((o) =>
    ["review", "executed", "accepted", "vetoed"].includes(o.state),
  );

  return {
    myId: managerId,
    windowOpen,
    windowLabel: windowOpen ? "Open" : "Closed",
    windowCloses,
    reopenAt,
    stats: [
      { label: "Received", value: String(received.filter((o) => o.state === "proposed").length) },
      { label: "Sent", value: String(sent.filter((o) => o.state === "proposed").length) },
      { label: "Window", value: windowOpen ? "Open" : "Closed" },
      { label: "Closes", value: windowOpen ? windowCloses ?? "-" : "-" },
    ],
    clubs,
    myRoster: rosters[managerId] ?? [],
    rosters,
    received,
    sent,
    league,
    offers,
  };
}
