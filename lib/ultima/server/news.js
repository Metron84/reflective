import { ULTIMA_LEAGUE_SHORT } from "@/lib/ultima/constants";
import { VOID_REASON_LINE } from "@/lib/ultima/trades/rules";
import { TRADE_LOG_EVENTS, marketLogLine, tradeLogLine } from "@/lib/ultima/trades/log-line";
import { getReadDb } from "@/lib/ultima/server/strict-db";

const NEWS_EVENTS = [
  "invite_redeemed",
  "pick_made",
  "market_add",
  "market_release",
  "xi_saved",
  "captain_set",
  "captain_removed",
  "trade_proposed",
  "trade_review",
  "trade_declined",
  "trade_cancelled",
  "trade_expired",
  "trade_veto",
  "trade_vetoed",
  "trade_executed",
  "trade_countered",
  "trade_awaiting_unlock",
  "trade_void",
  "clubs_synced",
];

function lineFor(event, teamName, payload, playerName, dropName, country) {
  const team = teamName || "A manager";
  switch (event) {
    case "invite_redeemed":
      return `${team} took a seat.`;
    case "pick_made":
      return playerName
        ? `${team} drafted ${playerName} at pick ${payload?.pick_number ?? "?"}.`
        : `${team} made pick ${payload?.pick_number ?? "?"}.`;
    case "market_add":
      if (playerName) return marketLogLine("market_add", { team, player: playerName, country });
      return `${team} used the market.`;
    case "market_release":
      return marketLogLine("market_release", { team, player: playerName });
    case "xi_saved":
      return `${team} set an XI.`;
    case "captain_set":
      return playerName ? `${team} named ${playerName} captain.` : `${team} named a captain.`;
    case "captain_removed":
      return playerName ? `${team} dropped the armband from ${playerName}.` : `${team} cleared a captain.`;
    case "clubs_synced":
      return payload?.line || "Club sync updated owned players. Check your XV.";
    case "trade_proposed":
      return `${team} sent you a trade.`;
    case "trade_review":
      return `${team} accepted a trade. League review is open.`;
    case "trade_declined":
      return `${team} declined your trade.`;
    case "trade_cancelled":
      return `${team} withdrew a trade.`;
    case "trade_veto":
      return `${team} vetoed a trade in review.`;
    case "trade_vetoed":
      return "A trade was vetoed by the league.";
    case "trade_countered":
      return `${team} countered a trade.`;
    case "trade_awaiting_unlock":
      return `A trade is held until the leagues unlock.`;
    case "trade_void": {
      const why = VOID_REASON_LINE[payload?.reason];
      return why ? `A trade was voided. ${why}` : "A trade was voided.";
    }
    case "trade_executed":
      if (payload?.swapA && payload?.swapB && payload?.swapN != null) {
        return `${payload.swapA} and ${payload.swapB} swapped ${payload.swapN} for ${payload.swapN}`;
      }
      return "A trade went through.";
    default:
      return `${team} · ${String(event).replace(/_/g, " ")}`;
  }
}

export async function getCompetitionNews(competitionId, limit = 40) {
  const db = getReadDb();
  if (!db || !competitionId) return [];

  const { data: events, error } = await db
    .from("ultima_events")
    .select("id, event, manager_id, payload, created_at")
    .eq("competition_id", competitionId)
    .in("event", NEWS_EVENTS)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!error) {
    return formatRows(events ?? [], false);
  }

  const { data: fallback } = await db
    .from("ultima_events")
    .select("id, event, manager_id, payload, created_at, ultima_managers!inner(team_name, competition_id)")
    .eq("ultima_managers.competition_id", competitionId)
    .in("event", NEWS_EVENTS)
    .order("created_at", { ascending: false })
    .limit(limit);

  return formatRows(fallback ?? [], true);
}

async function formatRows(rows, nested) {
  const db = getReadDb();
  const managerIds = [...new Set(rows.map((r) => r.manager_id).filter(Boolean))];
  const playerIds = [
    ...new Set(
      rows.flatMap((r) => {
        const p = r.payload ?? {};
        return [p.player_id, p.add, p.drop].filter(Boolean);
      }),
    ),
  ];

  const managers = {};
  if (!nested && managerIds.length) {
    const { data } = await db
      .from("ultima_managers")
      .select("id, team_name")
      .in("id", managerIds);
    for (const m of data ?? []) managers[m.id] = m.team_name;
  }

  const players = {};
  if (playerIds.length) {
    const { data } = await db.from("ultima_players").select("id, name, league").in("id", playerIds);
    for (const p of data ?? []) players[p.id] = p;
  }

  const tradeIds = [
    ...new Set(rows.map((row) => row.payload?.trade_id).filter(Boolean)),
  ];
  const trades = {};
  if (tradeIds.length) {
    const { data } = await db
      .from("ultima_trades")
      .select("id, proposer_id, receiver_id, ultima_trade_players(from_manager_id, ultima_players(name))")
      .in("id", tradeIds);
    for (const trade of data ?? []) trades[trade.id] = trade;
    const extraManagerIds = [
      ...new Set(
        (data ?? []).flatMap((t) => [t.proposer_id, t.receiver_id]).filter(Boolean),
      ),
    ].filter((id) => !managers[id]);
    if (extraManagerIds.length) {
      const { data: extra } = await db
        .from("ultima_managers")
        .select("id, team_name")
        .in("id", extraManagerIds);
      for (const m of extra ?? []) managers[m.id] = m.team_name;
    }
  }

  const namesFrom = (trade, managerId) =>
    (trade?.ultima_trade_players ?? [])
      .filter((row) => row.from_manager_id === managerId)
      .map((row) => row.ultima_players?.name)
      .filter(Boolean);

  return rows.map((row) => {
    const teamName = nested
      ? row.ultima_managers?.team_name
      : managers[row.manager_id];
    const payload = row.payload ?? {};
    const added = players[payload.player_id] ?? players[payload.add] ?? null;
    const dropped = players[payload.drop] ?? null;
    const playerName = added?.name ?? null;
    const dropName = dropped?.name ?? null;
    const country = added?.league ? ULTIMA_LEAGUE_SHORT[added.league] ?? null : null;
    const trade = payload.trade_id ? trades[payload.trade_id] : null;
    const tradeEvent = TRADE_LOG_EVENTS.includes(row.event) && Boolean(trade);

    // Every trade action is public league mail. The two managers in the deal
    // also see it as their own, through forManagerIds.
    let line;
    if (tradeEvent) {
      line = tradeLogLine(row.event, {
        actor: teamName,
        proposer: managers[trade.proposer_id],
        receiver: managers[trade.receiver_id],
        give: namesFrom(trade, trade.proposer_id),
        get: namesFrom(trade, trade.receiver_id),
        reason: payload.reason,
      });
    }
    if (!line) {
      line = lineFor(row.event, teamName, payload, playerName, dropName, country);
    }
    const isTrade = String(row.event).startsWith("trade");
    return {
      id: row.id,
      event: row.event,
      managerId: row.manager_id,
      at: row.created_at,
      href:
        row.event === "clubs_synced"
          ? "/ultima/squad"
          : payload.trade_id
            ? `/ultima/trades/${payload.trade_id}`
            : row.event === "market_add" || row.event === "market_release"
              ? "/ultima/market"
              : null,
      forManagerIds: isTrade && trade ? [trade.proposer_id, trade.receiver_id].filter(Boolean) : null,
      leagueMail: isTrade || row.event === "clubs_synced",
      line,
    };
  });
}
