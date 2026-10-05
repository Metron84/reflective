import {
  ULTIMA_LEAGUES,
  ULTIMA_LEAGUE_SHORT,
  ULTIMA_SQUAD_FLOOR_PER_LEAGUE,
  ULTIMA_SQUAD_SIZE,
} from "@/lib/ultima/constants";
import {
  ACCEPTED_STATES,
  FROZEN_LINE,
  LIVE_OFFER_CAP,
  LIVE_OFFER_HOURS,
  LIVE_STATES,
  acceptTooLate,
  canCancelTrade,
  checkIdLists,
  countVetoes,
  findBusy,
  floorMessage,
  floorShortfall,
  hasLiveOffer,
  isDue,
  liveCapReached,
  lockedLeagues,
  partyGuard,
  rateLimited,
  tradeGate,
  untouchableHit,
  vetoReached,
  VOID_REASON_LINE,
  expiresInLabel,
} from "@/lib/ultima/trades/rules";
import { validateTradeFairness } from "@/lib/ultima/trades/validator";
import { getUltimaDb } from "@/lib/ultima/server/db";
import { publishUltimaEvent } from "@/lib/ultima/server/events";
import { getManagerRoster } from "@/lib/ultima/server/lineup";
import { notifyTradeProposedAsync } from "@/lib/ultima/server/notify";
import { listManagerUntouchables, listUntouchables } from "@/lib/ultima/server/untouchables";
import { recordUltimaEvent } from "@/lib/ultima/server/record-event";
import { getStandings } from "@/lib/ultima/server/scoring-run";
import { buildTradeBoard } from "@/lib/ultima/server/trade-block";

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

/**
 * The gameweek that started most recently, and whether trading is open in it.
 * Trades are open from day one, before gameweek 1 included (gw is null then).
 * Only the trade deadline closes the window.
 */
export async function getTradeWindow(competitionId) {
  const db = getUltimaDb();
  if (!db || !competitionId) {
    return { gw: null, deadlineAt: null, gate: { ok: false, code: "UNAVAILABLE" } };
  }

  const [{ data: gw }, { data: comp }] = await Promise.all([
    db
      .from("ultima_gameweeks")
      .select("*")
      .eq("competition_id", competitionId)
      .lte("window_start", new Date().toISOString())
      .order("number", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.from("ultima_competition").select("trade_deadline_gw").eq("id", competitionId).maybeSingle(),
  ]);

  // The deadline closes with its gameweek. Null when there is no deadline, or
  // when that gameweek has not been synced yet.
  let deadlineAt = null;
  if (comp?.trade_deadline_gw != null) {
    const { data: deadlineGw } = await db
      .from("ultima_gameweeks")
      .select("window_end")
      .eq("competition_id", competitionId)
      .eq("number", comp.trade_deadline_gw)
      .maybeSingle();
    deadlineAt = deadlineGw?.window_end ?? null;
  }

  return {
    gw: gw ?? null,
    deadlineAt,
    gate: tradeGate({ gw, deadlineGw: comp?.trade_deadline_gw ?? null }),
  };
}

function fail(code, message) {
  return message ? { ok: false, code, message } : { ok: false, code };
}

/**
 * Checks that depend on the two squads and on other trades. Used when a trade
 * is proposed and again when it is accepted. `ignoreTradeId` is the trade
 * itself (on accept) or the offer being countered.
 */
async function checkDeal({
  competitionId,
  proposerId,
  receiverId,
  givePlayerIds,
  getPlayerIds,
  gameweekNumber,
  ignoreTradeId = null,
}) {
  const db = getUltimaDb();
  const proposerRoster = await getManagerRoster(proposerId);
  const receiverRoster = await getManagerRoster(receiverId);

  for (const id of givePlayerIds) {
    if (!proposerRoster.find((p) => p.id === id)) {
      return fail("FLOOR_VIOLATION", "A player you give is not on your squad.");
    }
  }
  for (const id of getPlayerIds) {
    if (!receiverRoster.find((p) => p.id === id)) {
      return fail("FLOOR_VIOLATION", "A player you want is not on their squad.");
    }
  }

  // Only an accepted deal freezes a player. A live offer freezes nobody.
  const allIds = [...givePlayerIds, ...getPlayerIds];
  const { data: frozenRows } = await db
    .from("ultima_trade_players")
    .select("player_id, trade_id, ultima_trades!inner(state)")
    .in("player_id", allIds)
    .in("ultima_trades.state", ACCEPTED_STATES);
  if (findBusy(frozenRows, ignoreTradeId)) {
    return fail("TRADE_FROZEN", FROZEN_LINE);
  }

  const pair = `and(proposer_id.eq.${proposerId},receiver_id.eq.${receiverId}),and(proposer_id.eq.${receiverId},receiver_id.eq.${proposerId})`;
  const { data: liveRows } = await db
    .from("ultima_trades")
    .select("id")
    .eq("competition_id", competitionId)
    .in("state", LIVE_STATES)
    .or(pair);
  if (hasLiveOffer(liveRows, ignoreTradeId)) {
    return fail("TRADE_LIVE_OFFER");
  }

  const givePlayers = proposerRoster.filter((p) => givePlayerIds.includes(p.id));
  const getPlayers = receiverRoster.filter((p) => getPlayerIds.includes(p.id));

  const youShort = floorShortfall(proposerRoster, givePlayerIds, getPlayers);
  if (youShort) return fail("FLOOR_VIOLATION", floorMessage(youShort, { you: true }));

  const themShort = floorShortfall(receiverRoster, getPlayerIds, givePlayers);
  if (themShort) {
    const { data: receiver } = await db
      .from("ultima_managers")
      .select("team_name")
      .eq("id", receiverId)
      .maybeSingle();
    return fail(
      "FLOOR_VIOLATION",
      floorMessage(themShort, { you: false, team: receiver?.team_name ?? "They" }),
    );
  }

  const verdict = validateTradeFairness(
    givePlayers.map(playerTradeMetrics),
    getPlayers.map(playerTradeMetrics),
    gameweekNumber,
  );

  return { ok: true, verdict, givePlayers, getPlayers };
}

export async function validateTradeProposal({
  competitionId,
  proposerId,
  receiverId,
  givePlayerIds,
  getPlayerIds,
  counterOf = null,
}) {
  const db = getUltimaDb();
  if (!db) return fail("UNAVAILABLE");

  await expireStaleTrades();

  const { gw, gate } = await getTradeWindow(competitionId);
  if (!gate.ok) return fail(gate.code);

  const lists = checkIdLists(givePlayerIds, getPlayerIds);
  if (!lists.ok) return fail(lists.code);

  const { data: parties } = await db
    .from("ultima_managers")
    .select("id, is_bot, competition_id")
    .in("id", [proposerId, receiverId].filter(Boolean));
  const partyCheck = partyGuard({ proposerId, receiverId, competitionId, managers: parties });
  if (!partyCheck.ok) return fail(partyCheck.code);

  const protectedIds = await listManagerUntouchables(receiverId);
  if (untouchableHit(getPlayerIds, protectedIds)) return fail("UNTOUCHABLE");

  if (counterOf) {
    const { data: original } = await db
      .from("ultima_trades")
      .select("id, state, proposer_id, receiver_id")
      .eq("id", counterOf)
      .maybeSingle();
    if (
      !original ||
      original.state !== "proposed" ||
      original.receiver_id !== proposerId ||
      original.proposer_id !== receiverId
    ) {
      return fail("UNAVAILABLE", "That offer is no longer open.");
    }
  }

  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count: sentToday } = await db
    .from("ultima_trades")
    .select("id", { count: "exact", head: true })
    .eq("proposer_id", proposerId)
    .gte("created_at", since);
  if (rateLimited(sentToday)) return fail("TRADE_LIMIT");

  // Three live outgoing offers at most. A counter replaces the original, so the
  // original does not count against the manager who answers it.
  const { count: liveCount } = await db
    .from("ultima_trades")
    .select("id", { count: "exact", head: true })
    .eq("proposer_id", proposerId)
    .in("state", LIVE_STATES);
  if (liveCapReached(liveCount)) return fail("TRADE_CAP");

  return checkDeal({
    competitionId,
    proposerId,
    receiverId,
    givePlayerIds,
    getPlayerIds,
    gameweekNumber: gw?.number ?? 0,
    ignoreTradeId: counterOf,
  });
}

export async function proposeTrade({
  competitionId,
  proposerId,
  receiverId,
  givePlayerIds,
  getPlayerIds,
  counterOf = null,
}) {
  const check = await validateTradeProposal({
    competitionId,
    proposerId,
    receiverId,
    givePlayerIds,
    getPlayerIds,
    counterOf,
  });
  if (!check.ok) return check;

  const db = getUltimaDb();

  // Only one live offer between two managers. A counter closes the original first.
  if (counterOf) {
    const { data: flipped } = await db
      .from("ultima_trades")
      .update({ state: "countered", resolved_at: new Date().toISOString() })
      .eq("id", counterOf)
      .eq("state", "proposed")
      .select("id")
      .maybeSingle();
    if (!flipped) return fail("UNAVAILABLE", "That offer is no longer open.");
  }

  async function reopenOriginal() {
    if (!counterOf) return;
    await db
      .from("ultima_trades")
      .update({ state: "proposed", resolved_at: null })
      .eq("id", counterOf)
      .eq("state", "countered");
  }

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

  if (error || !trade) {
    await reopenOriginal();
    // The database holds the same two rules as the checks above, so a race
    // between two sends still ends in the right message.
    if (/trade_live_cap/.test(error?.message ?? "")) return fail("TRADE_CAP");
    if (error?.code === "23505") return fail("TRADE_LIVE_OFFER");
    return fail("UNAVAILABLE");
  }

  const rows = [
    ...givePlayerIds.map((pid) => ({
      trade_id: trade.id,
      player_id: pid,
      from_manager_id: proposerId,
      to_manager_id: receiverId,
    })),
    ...getPlayerIds.map((pid) => ({
      trade_id: trade.id,
      player_id: pid,
      from_manager_id: receiverId,
      to_manager_id: proposerId,
    })),
  ];
  const { error: rowsError } = await db.from("ultima_trade_players").insert(rows);
  if (rowsError) {
    await db.from("ultima_trades").delete().eq("id", trade.id);
    await reopenOriginal();
    return fail("UNAVAILABLE");
  }

  if (counterOf) {
    await db.from("ultima_trades").update({ countered_by: trade.id }).eq("id", counterOf);
    await recordUltimaEvent({
      event: "trade_countered",
      managerId: proposerId,
      competitionId,
      payload: { trade_id: counterOf, counter_id: trade.id },
    });
    publishUltimaEvent("trade.state", { trade_id: counterOf, state: "countered" });
  }

  await recordUltimaEvent({
    event: "trade_proposed",
    managerId: proposerId,
    competitionId,
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

/** Runs the database function that settles one trade, all or nothing. */
export async function executeTrade(tradeId) {
  const db = getUltimaDb();
  if (!db) return { ok: false, code: "UNAVAILABLE" };

  const { data, error } = await db.rpc("ultima_execute_trade", {
    p_trade_id: tradeId,
    p_opens_gw: 0,
    p_squad_size: ULTIMA_SQUAD_SIZE,
    p_floor: ULTIMA_SQUAD_FLOOR_PER_LEAGUE,
  });
  if (error) return { ok: false, code: "UNAVAILABLE" };

  if (data?.ok) {
    publishUltimaEvent("trade.state", { trade_id: tradeId, state: data.state });
    for (const id of data.voided ?? []) {
      publishUltimaEvent("trade.state", { trade_id: id, state: "void" });
    }
  }
  return data ?? { ok: false, code: "UNAVAILABLE" };
}

/** Settles one trade if its review or hold has ended. Returns the settled result or null. */
export async function settleTrade(tradeId) {
  const db = getUltimaDb();
  if (!db || !tradeId) return null;
  const { data: trade } = await db
    .from("ultima_trades")
    .select("id, state, review_expires_at, unlock_at")
    .eq("id", tradeId)
    .maybeSingle();
  if (!trade || !isDue(trade)) return null;
  return executeTrade(tradeId);
}

/**
 * Live offers nobody answered in 48 hours expire. Runs whenever trades are
 * read or written, and in the daily job. One database call, an event per offer.
 */
export async function expireStaleTrades() {
  const db = getUltimaDb();
  if (!db) return { expired: [] };
  const { data, error } = await db.rpc("ultima_expire_trades", { p_hours: LIVE_OFFER_HOURS });
  if (error) {
    console.error("[ultima/trades] expire failed", error.message);
    return { expired: [] };
  }
  const expired = data?.expired ?? [];
  for (const row of expired) {
    publishUltimaEvent("trade.state", { trade_id: row.trade_id, state: "expired" });
  }
  return { expired };
}

/** Settles every due trade, in one competition or in all of them. */
export async function settleDueTrades(competitionId = null) {
  const db = getUltimaDb();
  if (!db) return { settled: 0 };

  await expireStaleTrades();

  const now = new Date().toISOString();
  let query = db
    .from("ultima_trades")
    .select("id")
    .or(
      `and(state.eq.review,review_expires_at.lte.${now}),and(state.eq.awaiting_unlock,unlock_at.lte.${now})`,
    )
    .order("created_at", { ascending: true })
    .limit(50);
  if (competitionId) query = query.eq("competition_id", competitionId);

  const { data: due } = await query;
  let settled = 0;
  for (const row of due ?? []) {
    const result = await executeTrade(row.id);
    if (result?.ok) settled += 1;
  }
  return { settled };
}

export async function respondToTrade({ tradeId, managerId, accept }) {
  const db = getUltimaDb();
  if (!db) return fail("UNAVAILABLE");

  await expireStaleTrades();
  await settleTrade(tradeId);

  const { data: trade } = await db
    .from("ultima_trades")
    .select("*")
    .eq("id", tradeId)
    .maybeSingle();

  if (!trade || trade.receiver_id !== managerId) return fail("UNAVAILABLE");
  if (trade.state === "expired") return fail("TRADE_EXPIRED");
  if (trade.state !== "proposed") return fail("UNAVAILABLE", "That trade is no longer open.");

  const { gw, gate, deadlineAt } = await getTradeWindow(trade.competition_id);
  if (!gate.ok) return fail(gate.code);

  if (accept && acceptTooLate({ deadlineAt, reviewHours: REVIEW_HOURS })) {
    return fail("TRADE_TOO_LATE");
  }

  if (!accept) {
    const { data: declined } = await db
      .from("ultima_trades")
      .update({ state: "declined", resolved_at: new Date().toISOString() })
      .eq("id", tradeId)
      .eq("state", "proposed")
      .select("id")
      .maybeSingle();
    if (!declined) return fail("UNAVAILABLE", "That trade is no longer open.");
    await recordUltimaEvent({
      event: "trade_declined",
      managerId,
      competitionId: trade.competition_id,
      payload: { trade_id: tradeId },
    });
    publishUltimaEvent("trade.state", { trade_id: tradeId, state: "declined" });
    return { ok: true, state: "declined" };
  }

  const { data: tradePlayers } = await db
    .from("ultima_trade_players")
    .select("player_id, from_manager_id")
    .eq("trade_id", tradeId);
  const check = await checkDeal({
    competitionId: trade.competition_id,
    proposerId: trade.proposer_id,
    receiverId: trade.receiver_id,
    givePlayerIds: (tradePlayers ?? []).filter((r) => r.from_manager_id === trade.proposer_id).map((r) => r.player_id),
    getPlayerIds: (tradePlayers ?? []).filter((r) => r.from_manager_id === trade.receiver_id).map((r) => r.player_id),
    gameweekNumber: gw?.number ?? 0,
    ignoreTradeId: tradeId,
  });
  if (!check.ok) return check;

  // Atomic in the database: the deal's players freeze and every other live
  // offer that holds any of them is voided in the same transaction.
  const { data: accepted, error: acceptError } = await db.rpc("ultima_accept_trade", {
    p_trade_id: tradeId,
    p_manager_id: managerId,
    p_review_hours: REVIEW_HOURS,
    p_live_hours: LIVE_OFFER_HOURS,
  });
  if (acceptError || !accepted) return fail("UNAVAILABLE");

  if (!accepted.ok) {
    switch (accepted.code) {
      case "EXPIRED":
        publishUltimaEvent("trade.state", { trade_id: tradeId, state: "expired" });
        return fail("TRADE_EXPIRED");
      case "PLAYER_FROZEN":
        publishUltimaEvent("trade.state", { trade_id: tradeId, state: "void" });
        return fail("TRADE_FROZEN", FROZEN_LINE);
      case "OWNERSHIP":
        publishUltimaEvent("trade.state", { trade_id: tradeId, state: "void" });
        return fail("UNAVAILABLE", "A player left the squad. That offer is void.");
      default:
        return fail("UNAVAILABLE", "That trade is no longer open.");
    }
  }

  publishUltimaEvent("trade.state", { trade_id: tradeId, state: "review" });
  for (const row of accepted.voided ?? []) {
    publishUltimaEvent("trade.state", { trade_id: row.trade_id, state: "void" });
  }
  return {
    ok: true,
    state: "review",
    reviewExpires: accepted.review_expires_at,
    voided: (accepted.voided ?? []).length,
  };
}

/** The proposer withdraws an offer that nobody has answered yet. */
export async function cancelTrade({ tradeId, managerId }) {
  const db = getUltimaDb();
  if (!db || !tradeId || !managerId) return fail("UNAVAILABLE");

  const { data: trade } = await db
    .from("ultima_trades")
    .select("id, state, proposer_id, competition_id")
    .eq("id", tradeId)
    .maybeSingle();
  if (!trade || trade.proposer_id !== managerId) return fail("UNAVAILABLE");
  if (!canCancelTrade(trade, managerId)) {
    return fail("UNAVAILABLE", "That offer is no longer open.");
  }

  const { data: cancelled } = await db
    .from("ultima_trades")
    .update({ state: "cancelled", resolved_at: new Date().toISOString() })
    .eq("id", tradeId)
    .eq("state", "proposed")
    .select("id")
    .maybeSingle();
  if (!cancelled) return fail("UNAVAILABLE", "That offer is no longer open.");

  await recordUltimaEvent({
    event: "trade_cancelled",
    managerId,
    competitionId: trade.competition_id,
    payload: { trade_id: tradeId },
  });
  publishUltimaEvent("trade.state", { trade_id: tradeId, state: "cancelled" });
  return { ok: true, state: "cancelled" };
}

export async function vetoTrade({ tradeId, managerId }) {
  const db = getUltimaDb();
  if (!db) return fail("UNAVAILABLE");

  // A review that has ended settles first, so a late veto is turned away.
  await settleTrade(tradeId);

  const { data: trade } = await db.from("ultima_trades").select("*").eq("id", tradeId).maybeSingle();
  if (!trade) return fail("UNAVAILABLE");
  if (trade.state !== "review") {
    return ["awaiting_unlock", "executed", "vetoed", "void"].includes(trade.state)
      ? fail("TRADE_REVIEW_CLOSED")
      : fail("UNAVAILABLE");
  }
  if (trade.review_expires_at && new Date(trade.review_expires_at).getTime() <= Date.now()) {
    return fail("TRADE_REVIEW_CLOSED");
  }

  const { gate } = await getTradeWindow(trade.competition_id);
  if (!gate.ok) return fail(gate.code);

  if (trade.proposer_id === managerId || trade.receiver_id === managerId) {
    return fail("UNAVAILABLE", "Trade parties cannot veto.");
  }

  const { data: managers } = await db
    .from("ultima_managers")
    .select("id, is_bot")
    .eq("competition_id", trade.competition_id);
  const voter = (managers ?? []).find((m) => m.id === managerId);
  if (!voter) return fail("UNAVAILABLE");
  if (voter.is_bot) return fail("UNAVAILABLE", "Bots do not vote.");

  const eligibleIds = (managers ?? [])
    .filter((m) => !m.is_bot && m.id !== trade.proposer_id && m.id !== trade.receiver_id)
    .map((m) => m.id);

  const { error: voteError } = await db
    .from("ultima_trade_votes")
    .upsert({ trade_id: tradeId, manager_id: managerId, veto: true }, { onConflict: "trade_id,manager_id" });
  if (voteError) return fail("UNAVAILABLE");

  // The votes table has no id column. Read the rows and count managers.
  const { data: votes } = await db
    .from("ultima_trade_votes")
    .select("manager_id, veto")
    .eq("trade_id", tradeId);
  const vetoCount = countVetoes(votes, eligibleIds);

  if (vetoReached(votes, eligibleIds)) {
    const { data: vetoed } = await db
      .from("ultima_trades")
      .update({ state: "vetoed", resolved_at: new Date().toISOString() })
      .eq("id", tradeId)
      .eq("state", "review")
      .select("id")
      .maybeSingle();
    if (vetoed) {
      await recordUltimaEvent({
        event: "trade_vetoed",
        managerId,
        competitionId: trade.competition_id,
        payload: { trade_id: tradeId, votes: vetoCount },
      });
      publishUltimaEvent("trade.state", { trade_id: tradeId, state: "vetoed" });
    }
    return { ok: true, vetoed: true, votes: vetoCount };
  }

  await recordUltimaEvent({
    event: "trade_veto",
    managerId,
    competitionId: trade.competition_id,
    payload: { trade_id: tradeId, votes: vetoCount },
  });
  publishUltimaEvent("trade.state", { trade_id: tradeId, state: "review", votes: vetoCount });
  return { ok: true, vetoed: false, votes: vetoCount };
}

/**
 * Live offers that include players this manager is about to release. Accepted
 * deals are not here: those players cannot be released at all.
 * Returns a Map of player id to the other team's names, for the confirm line.
 */
export async function listPendingTradeTeams(managerId, playerIds) {
  const db = getUltimaDb();
  const out = new Map();
  const ids = (playerIds ?? []).filter(Boolean);
  if (!db || !managerId || !ids.length) return out;

  const { data: rows } = await db
    .from("ultima_trade_players")
    .select("player_id, ultima_trades!inner(id, state, proposer_id, receiver_id)")
    .eq("from_manager_id", managerId)
    .in("player_id", ids)
    .in("ultima_trades.state", LIVE_STATES);

  const otherIds = new Set();
  for (const row of rows ?? []) {
    const t = row.ultima_trades;
    otherIds.add(t.proposer_id === managerId ? t.receiver_id : t.proposer_id);
  }
  if (!otherIds.size) return out;

  const { data: managers } = await db
    .from("ultima_managers")
    .select("id, team_name")
    .in("id", [...otherIds]);
  const teamById = new Map((managers ?? []).map((m) => [m.id, m.team_name]));

  for (const row of rows ?? []) {
    const t = row.ultima_trades;
    const other = t.proposer_id === managerId ? t.receiver_id : t.proposer_id;
    const list = out.get(row.player_id) ?? [];
    list.push(teamById.get(other) ?? "another club");
    out.set(row.player_id, list);
  }
  return out;
}

/**
 * Voids this manager's live offers that include players leaving the squad.
 * One database call, with a news and log event per trade.
 */
export async function voidTradesForPlayers(managerId, playerIds, reason = "player_released") {
  const db = getUltimaDb();
  const ids = (playerIds ?? []).filter(Boolean);
  if (!db || !managerId || !ids.length) return [];

  const { data, error } = await db.rpc("ultima_void_trades_for_players", {
    p_manager_id: managerId,
    p_player_ids: ids,
    p_reason: reason,
  });
  if (error) {
    console.error("[ultima/trades] void for players failed", error.message);
    return [];
  }
  const voided = data?.voided ?? [];
  for (const row of voided) {
    publishUltimaEvent("trade.state", { trade_id: row.trade_id, state: "void" });
  }
  return voided;
}

/** Daily job entry point. Reads and writes settle lazily too. */
export async function expireTradeReviews() {
  const { expired } = await expireStaleTrades();
  const { settled } = await settleDueTrades();
  return { ok: true, executed: settled, expired: expired.length };
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

  await settleDueTrades(competitionId);

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

export async function previewTradeVerdict({ competitionId, proposerId, receiverId, givePlayerIds, getPlayerIds, counterOf = null }) {
  const check = await validateTradeProposal({
    competitionId,
    proposerId,
    receiverId,
    givePlayerIds,
    getPlayerIds,
    counterOf,
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
  if (state === "proposed") return "Live";
  if (state === "review") return "In veto";
  if (state === "awaiting_unlock") return "Held";
  if (state === "declined") return "Declined";
  if (state === "vetoed") return "Vetoed";
  if (state === "countered") return "Countered";
  if (state === "cancelled") return "Withdrawn";
  if (state === "void") return "Void";
  if (state === "expired") return "Expired";
  if (state === "executed") return "Done";
  if (state === "accepted") return "Accepted";
  return state ?? "-";
}

/** Where an offer sits for the all-offers list. */
export function offerGroup(state) {
  if (state === "proposed") return "live";
  if (state === "review" || state === "awaiting_unlock") return "accepted";
  if (state === "executed") return "done";
  return "closed";
}

function countriesFrom(players) {
  const set = new Set((players ?? []).map((p) => p.league).filter(Boolean));
  return ULTIMA_LEAGUES.filter((league) => set.has(league));
}

function mapOffer(trade, myId, clubById, votes, gw) {
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
    group: offerGroup(trade.state),
    voidLine: trade.state === "void" ? VOID_REASON_LINE[trade.void_reason] ?? null : null,
    expiresIn: trade.state === "proposed" ? expiresInLabel(trade.created_at) : null,
    unread: trade.state === "proposed" && trade.receiver_id === myId,
    createdAt: trade.created_at,
    reviewExpiresAt: trade.review_expires_at ?? null,
    unlockAt: trade.unlock_at ?? null,
    heldLeagues:
      trade.state === "awaiting_unlock"
        ? lockedLeagues(gw).filter((league) => all.some((p) => p.league === league))
        : [],
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
    canCancel: canCancelTrade(trade, myId),
    canVeto: trade.state === "review" && !isParty,
    alreadyVetoed: vetoes.some((v) => v.manager_id === myId),
  };
}

export async function getTradeOffice({ competitionId, managerId }) {
  const db = getUltimaDb();
  if (!db || !competitionId || !managerId) return null;

  await settleDueTrades(competitionId);

  const [tradeWindow, standings, { data: managers }, { data: trades }] = await Promise.all([
    getTradeWindow(competitionId),
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

  const offers = (trades ?? []).map((trade) => mapOffer(trade, managerId, clubById, votes, tradeWindow.gw));

  const humanIds = clubs.filter((c) => !c.is_bot).map((c) => c.id);
  const rosterEntries = await Promise.all(
    humanIds.map(async (id) => [id, (await getManagerRoster(id)).map(slimPlayer)]),
  );
  const rosters = Object.fromEntries(rosterEntries);

  const board = await buildTradeBoard({ competitionId, managerId, clubs, rosters });
  const untouchableMap = board.untouchable ?? (await listUntouchables(competitionId));
  const untouchable = Object.fromEntries(Object.values(untouchableMap).flat().map((id) => [id, true]));
  const myRosterList = rosters[managerId] ?? [];

  const windowOpen = tradeWindow.gate.ok;
  const windowReason = windowOpen ? null : tradeWindow.gate.code;
  const reopenAt = null;
  const liveOutgoing = offers.filter((o) => o.proposerId === managerId && o.state === "proposed").length;

  // Frozen: players in an accepted deal. Live counts: how many live offers hold a player.
  const frozen = {};
  const liveCounts = {};
  for (const trade of trades ?? []) {
    const ids = (trade.ultima_trade_players ?? []).map((row) => row.player_id).filter(Boolean);
    if (ACCEPTED_STATES.includes(trade.state)) for (const id of ids) frozen[id] = true;
    if (trade.state === "proposed") for (const id of ids) liveCounts[id] = (liveCounts[id] ?? 0) + 1;
  }

  const received = offers.filter((o) => o.receiverId === managerId);
  const sent = offers.filter((o) => o.proposerId === managerId);
  // Every offer is public: the All tab lists them by status.
  const league = offers;

  return {
    myId: managerId,
    windowOpen,
    windowLabel: windowOpen ? "Open" : "Closed",
    windowReason,
    reopenAt,
    liveOutgoing,
    liveCap: LIVE_OFFER_CAP,
    frozen,
    liveCounts,
    stats: [
      { label: "Received", value: String(received.filter((o) => o.state === "proposed").length) },
      { label: "Live sent", value: `${liveOutgoing}/${LIVE_OFFER_CAP}` },
      { label: "Interest", value: String(board.inbox.filter((i) => i.state === "new").length) },
      { label: "Window", value: windowOpen ? "Open" : "Closed" },
      { label: "Held", value: String(offers.filter((o) => o.state === "awaiting_unlock" && o.party).length) },
    ],
    clubs,
    hasSquad: myRosterList.length > 0,
    board,
    untouchable,
    myUntouchable: untouchableMap[managerId] ?? [],
    myRoster: myRosterList,
    rosters,
    received,
    sent,
    league,
    offers,
  };
}
