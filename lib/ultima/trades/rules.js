import {
  ULTIMA_LEAGUES,
  ULTIMA_LEAGUE_SHORT,
  ULTIMA_SQUAD_FLOOR_PER_LEAGUE,
  ULTIMA_TRADE_OPENS_GW,
} from "../constants.js";

/** Pure trade rules. No database, no clock reads unless passed in. */

export const PENDING_STATES = ["proposed", "review", "awaiting_unlock"];
export const PROPOSALS_PER_DAY = 20;

/**
 * GW gate. `gw` is the gameweek that started most recently, or null.
 * `deadlineGw` is the last gameweek a trade may settle in. Null means no
 * deadline.
 */
export function tradeGate({ gw, deadlineGw, opensGw = ULTIMA_TRADE_OPENS_GW }) {
  if (!gw || !Number.isFinite(gw.number) || gw.number < opensGw) {
    return { ok: false, code: "TRADE_TOO_EARLY" };
  }
  if (deadlineGw != null && Number.isFinite(deadlineGw) && gw.number > deadlineGw) {
    return { ok: false, code: "TRADE_DEADLINE" };
  }
  return { ok: true };
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

/** "This voids your pending trade with Doumani Athletic." */
export function pendingTradeLine(teamNames) {
  const names = (teamNames ?? []).filter(Boolean);
  if (!names.length) return "";
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `This voids your pending ${names.length === 1 ? "trade" : "trades"} with ${list}.`;
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
  player_dropped: "A player was dropped.",
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

/** A player in the deal that already sits in another pending trade. */
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
