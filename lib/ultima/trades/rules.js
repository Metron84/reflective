import {
  ULTIMA_LEAGUES,
  ULTIMA_LEAGUE_SHORT,
  ULTIMA_SQUAD_FLOOR_PER_LEAGUE,
} from "../constants.js";

/** Pure trade rules. No database, no clock reads unless passed in. */

export const PENDING_STATES = ["proposed", "review", "awaiting_unlock"];
/** Live: sent and not yet accepted. A live offer freezes nobody. */
export const LIVE_STATES = ["proposed"];
/** Accepted: in league review or held for the Friday unlock. Its players are frozen. */
export const ACCEPTED_STATES = ["review", "awaiting_unlock"];
export const PROPOSALS_PER_DAY = 20;
/** Live outgoing offers one manager may hold at once. */
export const LIVE_OFFER_CAP = 3;
/** An unanswered offer expires after this many hours. */
export const LIVE_OFFER_HOURS = 48;

export const LIVE_CAP_LINE = `You have ${LIVE_OFFER_CAP} live offers. Withdraw one first.`;
export const FROZEN_LINE = "That player is already in an accepted deal.";

/**
 * Trades are open from the first day. `gw` is the gameweek that started most
 * recently, or null before gameweek 1. `deadlineGw` is the last gameweek a
 * trade may settle in. Null means no deadline.
 */
export function tradeGate({ gw, deadlineGw }) {
  if (gw && Number.isFinite(gw.number) && deadlineGw != null && Number.isFinite(deadlineGw) && gw.number > deadlineGw) {
    return { ok: false, code: "TRADE_DEADLINE" };
  }
  return { ok: true };
}

/** Three live outgoing offers is the most one manager may hold. */
export function liveCapReached(liveCount) {
  return (liveCount ?? 0) >= LIVE_OFFER_CAP;
}

/** True when a live offer has gone unanswered past its 48 hours. */
export function offerExpired(trade, now = Date.now()) {
  if (!trade || trade.state !== "proposed" || !trade.created_at) return false;
  const created = new Date(trade.created_at).getTime();
  return Number.isFinite(created) && created + LIVE_OFFER_HOURS * 3_600_000 <= now;
}

/** "Expires in 5h 10m" for a live offer, or null once it is past. */
export function expiresInLabel(createdAt, now = Date.now()) {
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return null;
  const left = created + LIVE_OFFER_HOURS * 3_600_000 - now;
  if (left <= 0) return null;
  const hours = Math.floor(left / 3_600_000);
  const minutes = Math.floor((left % 3_600_000) / 60_000);
  return hours > 0 ? `${hours}h ${minutes}m` : `${Math.max(1, minutes)}m`;
}

/**
 * Accept starts a review. It is blocked when the review would end after the
 * deadline. `deadlineAt` is the close of the deadline gameweek, or null when
 * there is no deadline or that gameweek is not synced yet.
 */
export function acceptTooLate({ deadlineAt, now = Date.now(), reviewHours = 24 }) {
  if (!deadlineAt) return false;
  const end = new Date(deadlineAt).getTime();
  if (!Number.isFinite(end)) return false;
  return now + reviewHours * 3_600_000 > end;
}

/** "This voids your live offer to Doumani Athletic." Only live offers can be voided by a release. */
export function pendingTradeLine(teamNames) {
  const names = (teamNames ?? []).filter(Boolean);
  if (!names.length) return "";
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `This voids your live ${names.length === 1 ? "offer" : "offers"} with ${list}.`;
}

/** Same id twice, an empty side, or unequal sides. */
export function checkIdLists(giveIds, getIds) {
  const give = Array.isArray(giveIds) ? giveIds : [];
  const get = Array.isArray(getIds) ? getIds : [];
  if (!give.length || !get.length) return { ok: false, code: "TRADE_EMPTY" };
  if (new Set(give).size !== give.length || new Set(get).size !== get.length) {
    return { ok: false, code: "TRADE_DUPLICATE" };
  }
  if (give.some((id) => get.includes(id))) return { ok: false, code: "TRADE_DUPLICATE" };
  if (give.length !== get.length) return { ok: false, code: "TRADE_UNEVEN" };
  return { ok: true };
}

function leagueCounts(roster) {
  const counts = Object.fromEntries(ULTIMA_LEAGUES.map((l) => [l, 0]));
  for (const player of roster ?? []) {
    if (player.league in counts) counts[player.league] += 1;
  }
  return counts;
}

/**
 * First league whose floor gap gets worse after the swap, or null.
 * An existing shortfall (e.g. after a club-sync league move) is not a penalty;
 * only moves that deepen the gap are blocked.
 */
export function floorShortfall(roster, outIds, incoming, floor = ULTIMA_SQUAD_FLOOR_PER_LEAGUE) {
  const before = leagueCounts(roster);
  const after = leagueCounts(
    (roster ?? []).filter((p) => !outIds.includes(p.id)).concat(incoming ?? []),
  );
  for (const league of ULTIMA_LEAGUES) {
    const beforeDef = Math.max(0, floor - (before[league] ?? 0));
    const afterDef = Math.max(0, floor - (after[league] ?? 0));
    if (afterDef > beforeDef) {
      return { league, count: after[league] ?? 0, floor };
    }
  }
  return null;
}

/** "This leaves you with 2 ITA. You need 3." */
export function floorMessage(short, { you = true, team = "They" } = {}) {
  const tag = ULTIMA_LEAGUE_SHORT[short.league] ?? short.league;
  return you
    ? `This leaves you with ${short.count} ${tag}. You need ${short.floor}.`
    : `This leaves ${team} with ${short.count} ${tag}. They need ${short.floor}.`;
}

export function vetoMajority(otherHumans) {
  return Math.floor(otherHumans / 2) + 1;
}

/**
 * Counts vetoes that may count: one row per eligible manager. Parties, bots and
 * anyone outside the league are ignored. `votes` rows are { manager_id, veto }.
 */
export function countVetoes(votes, eligibleIds) {
  const eligible = new Set(eligibleIds);
  const counted = new Set();
  for (const vote of votes ?? []) {
    if (vote.veto && eligible.has(vote.manager_id)) counted.add(vote.manager_id);
  }
  return counted.size;
}

export function vetoReached(votes, eligibleIds) {
  const n = countVetoes(votes, eligibleIds);
  return n > 0 && n >= vetoMajority(eligibleIds.length);
}

/** Leagues whose matchday has opened and whose window has not ended. */
export function lockedLeagues(gw, now = Date.now()) {
  if (!gw?.league_open_at || typeof gw.league_open_at !== "object") return [];
  const end = gw.window_end ? new Date(gw.window_end).getTime() : Infinity;
  return ULTIMA_LEAGUES.filter((league) => {
    const open = gw.league_open_at[league];
    if (!open) return false;
    const t = new Date(open).getTime();
    return Number.isFinite(t) && t <= now && now < end;
  });
}

/** True when a pending trade is past its review or unlock time. */
export function isDue(trade, now = Date.now()) {
  if (trade.state === "review") {
    return trade.review_expires_at != null && new Date(trade.review_expires_at).getTime() <= now;
  }
  if (trade.state === "awaiting_unlock") {
    return trade.unlock_at != null && new Date(trade.unlock_at).getTime() <= now;
  }
  return false;
}

/** Plain lines for a void reason, used by news and the log. */
export const VOID_REASON_LINE = {
  player_traded: "A player moved in another trade.",
  ownership_changed: "A player left the squad.",
  player_dropped: "A player was released.",
  player_released: "A player was released.",
  player_in_accepted_deal: "That player is already in an accepted deal.",
  pick_undone: "The commissioner undid a pick.",
  floor: "It broke a league floor.",
  squad_size: "It broke the squad size.",
  deadline_passed: "The trade deadline passed.",
  not_open: "Trades were not open.",
  bot_manager: "A bot cannot trade.",
  empty: "The trade had no players.",
};

/** Receiver and proposer must exist in this competition, be different, and be human. */
export function partyGuard({ proposerId, receiverId, competitionId, managers }) {
  if (!receiverId || receiverId === proposerId) return { ok: false, code: "UNAVAILABLE" };
  const proposer = (managers ?? []).find((m) => m.id === proposerId);
  const receiver = (managers ?? []).find((m) => m.id === receiverId);
  if (
    !proposer ||
    !receiver ||
    proposer.competition_id !== competitionId ||
    receiver.competition_id !== competitionId
  ) {
    return { ok: false, code: "UNAVAILABLE" };
  }
  if (proposer.is_bot || receiver.is_bot) return { ok: false, code: "TRADE_BOT" };
  return { ok: true };
}

export function rateLimited(sentToday) {
  return (sentToday ?? 0) >= PROPOSALS_PER_DAY;
}

/** A player in the deal that already sits in another accepted trade. */
export function findBusy(rows, ignoreTradeId = null) {
  return (rows ?? []).find((row) => row.trade_id !== ignoreTradeId) ?? null;
}

/** Another live offer between the same two managers. */
export function hasLiveOffer(rows, ignoreTradeId = null) {
  return (rows ?? []).some((row) => row.id !== ignoreTradeId);
}

// ---------------------------------------------------------------------------
// Trades open: cancel, untouchable, looking for.
// ---------------------------------------------------------------------------

export const UNTOUCHABLE_MAX = 3;
export const LOOKING_FOR_MAX = 60;
export const UNTOUCHABLE_LINE = "That player is untouchable.";

/** Only the proposer may withdraw, and only while the offer is still proposed. */
export function canCancelTrade(trade, managerId) {
  return Boolean(trade && managerId && trade.state === "proposed" && trade.proposer_id === managerId);
}

/** First asked-for player the receiver has marked untouchable, or null. */
export function untouchableHit(getPlayerIds, untouchableIds) {
  const set = new Set(untouchableIds ?? []);
  return (getPlayerIds ?? []).find((id) => set.has(id)) ?? null;
}

/** Adding one more untouchable. `current` is the manager's present list. */
export function canAddUntouchable(current, playerId) {
  const list = current ?? [];
  if (list.includes(playerId)) return { ok: true, already: true };
  if (list.length >= UNTOUCHABLE_MAX) return { ok: false, code: "UNTOUCHABLE_LIMIT" };
  return { ok: true, already: false };
}
