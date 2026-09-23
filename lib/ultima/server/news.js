import { ULTIMA_LEAGUE_SHORT } from "@/lib/ultima/constants";
import { getUltimaDb } from "@/lib/ultima/server/db";

const NEWS_EVENTS = [
  "invite_redeemed",
  "pick_made",
  "market_add",
  "xi_saved",
  "trade_proposed",
  "trade_review",
  "trade_declined",
  "trade_veto",
  "trade_vetoed",
  "trade_executed",
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
      if (playerName && country) return `${team} signed ${playerName} (${country})`;
      if (playerName) return `${team} signed ${playerName}`;
      return `${team} used the market.`;
    case "xi_saved":
      return `${team} set an XI.`;
    case "trade_proposed":
      return `${team} sent you a trade.`;
    case "trade_review":
      return `${team} accepted a trade. League review is open.`;
    case "trade_declined":
      return `${team} declined your trade.`;
    case "trade_veto":
      return `${team} vetoed a trade in review.`;
    case "trade_vetoed":
      return "A trade was vetoed by the league.";
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
  const db = getUltimaDb();
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
  const db = getUltimaDb();
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
      .select("id, proposer_id, receiver_id, ultima_trade_players(player_id)")
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
    const swapN = trade ? (trade.ultima_trade_players ?? []).length / 2 : null;
    const swapPayload = trade
      ? {
          ...payload,
          swapA: managers[trade.proposer_id],
          swapB: managers[trade.receiver_id],
          swapN: Number.isFinite(swapN) ? Math.round(swapN) : (trade.ultima_trade_players ?? []).length / 2,
        }
      : payload;
    const personal =
      row.event === "trade_proposed"
        ? [trade?.receiver_id].filter(Boolean)
        : row.event === "trade_declined"
          ? [trade?.proposer_id].filter(Boolean)
          : row.event === "trade_review"
            ? [trade?.proposer_id, trade?.receiver_id].filter(Boolean)
            : null;
    return {
      id: row.id,
      event: row.event,
      managerId: row.manager_id,
      at: row.created_at,
      href: payload.trade_id ? `/ultima/trades/${payload.trade_id}` : null,
      forManagerIds: personal,
      leagueMail: row.event === "trade_executed" || row.event === "trade_vetoed",
      line: lineFor(row.event, teamName, swapPayload, playerName, dropName, country),
    };
  });
}
