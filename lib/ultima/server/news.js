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

function lineFor(event, teamName, payload, playerName, dropName) {
  const team = teamName || "A manager";
  switch (event) {
    case "invite_redeemed":
      return `${team} took a seat.`;
    case "pick_made":
      return playerName
        ? `${team} drafted ${playerName} at pick ${payload?.pick_number ?? "?"}.`
        : `${team} made pick ${payload?.pick_number ?? "?"}.`;
    case "market_add":
      if (playerName && dropName) return `${team} added ${playerName} and dropped ${dropName}.`;
      if (playerName) return `${team} added ${playerName}.`;
      return `${team} used the market.`;
    case "xi_saved":
      return `${team} set an XI.`;
    case "trade_proposed":
      return `${team} sent a trade.`;
    case "trade_review":
      return `${team} accepted a trade. League review is open.`;
    case "trade_declined":
      return `${team} declined a trade.`;
    case "trade_veto":
      return `${team} vetoed a trade in review.`;
    case "trade_vetoed":
      return "A trade was vetoed by the league.";
    case "trade_executed":
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
    const { data } = await db.from("ultima_players").select("id, name").in("id", playerIds);
    for (const p of data ?? []) players[p.id] = p.name;
  }

  return rows.map((row) => {
    const teamName = nested
      ? row.ultima_managers?.team_name
      : managers[row.manager_id];
    const payload = row.payload ?? {};
    const playerName = players[payload.player_id] ?? players[payload.add] ?? null;
    const dropName = players[payload.drop] ?? null;
    return {
      id: row.id,
      event: row.event,
      at: row.created_at,
      line: lineFor(row.event, teamName, payload, playerName, dropName),
    };
  });
}
