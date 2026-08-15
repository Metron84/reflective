import { ULTIMA_TRADE_OPENS_GW, ULTIMA_SQUAD_FLOOR_PER_LEAGUE, ULTIMA_LEAGUES } from "@/lib/ultima/constants";
import { validateTradeFairness } from "@/lib/ultima/trades/validator";
import { publishUltimaEvent } from "@/lib/ultima/server/events";
import { notifyTradeProposedAsync } from "@/lib/ultima/server/notify";
import { getUltimaDb } from "@/lib/ultima/server/db";
import { getManagerRoster, squadLeagueCounts } from "@/lib/ultima/server/lineup";

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

  await db.from("ultima_events").insert({
    event: "trade_proposed",
    manager_id: proposerId,
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
    publishUltimaEvent("trade.state", { trade_id: tradeId, state: "declined" });
    return { ok: true, state: "declined" };
  }

  const reviewExpires = new Date(Date.now() + REVIEW_HOURS * 3600_000).toISOString();
  await db
    .from("ultima_trades")
    .update({ state: "review", review_expires_at: reviewExpires })
    .eq("id", tradeId);

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
    publishUltimaEvent("trade.state", { trade_id: tradeId, state: "vetoed" });
    return { ok: true, vetoed: true };
  }

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

  await db.from("ultima_events").insert({
    event: "trade_executed",
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
