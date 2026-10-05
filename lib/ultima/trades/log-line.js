/**
 * One plain line per trade event for the Log page. Pure: callers pass names.
 * ctx: { actor, proposer, receiver, give: [names], get: [names], reason, voters }
 * `give` is what the proposer gives, `get` what the receiver gives.
 */
import { VOID_REASON_LINE } from "./rules.js";

export const TRADE_LOG_EVENTS = [
  "trade_proposed",
  "trade_countered",
  "trade_declined",
  "trade_cancelled",
  "trade_expired",
  "trade_review",
  "trade_veto",
  "trade_vetoed",
  "trade_executed",
  "trade_void",
];

function names(list) {
  const items = (list ?? []).filter(Boolean);
  if (!items.length) return "players";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function deal(ctx) {
  return `${names(ctx.give)} for ${names(ctx.get)}`;
}

export function tradeLogLine(event, ctx = {}) {
  const proposer = ctx.proposer || "A manager";
  const receiver = ctx.receiver || "a manager";
  switch (event) {
    case "trade_proposed":
      return `${proposer} offered ${receiver} ${deal(ctx)}.`;
    case "trade_countered":
      return `${ctx.actor || proposer} countered ${receiver}. ${deal(ctx)}.`;
    case "trade_declined":
      return `${receiver} declined ${deal(ctx)} from ${proposer}.`;
    case "trade_cancelled":
      return `${proposer} withdrew an offer to ${receiver}. ${deal(ctx)}.`;
    case "trade_expired":
      return `${proposer}'s offer to ${receiver} expired. ${deal(ctx)}.`;
    case "trade_review":
      return `${receiver} accepted ${deal(ctx)} from ${proposer}. League review is open.`;
    case "trade_veto":
      return `${ctx.actor || "A manager"} vetoed ${proposer} and ${receiver}.`;
    case "trade_vetoed":
      return `The league vetoed ${deal(ctx)} between ${proposer} and ${receiver}.`;
    case "trade_executed":
      return `${proposer} and ${receiver} traded ${deal(ctx)}.`;
    case "trade_void": {
      const why = VOID_REASON_LINE[ctx.reason];
      return `${deal(ctx)} between ${proposer} and ${receiver} was voided.${why ? ` ${why}` : ""}`;
    }
    default:
      return null;
  }
}

export const MARKET_LOG_EVENTS = ["market_add", "market_release"];

/**
 * Signing and release lines for the Log and the Hub. ctx: { team, player, country }.
 */
export function marketLogLine(event, ctx = {}) {
  const team = ctx.team || "A manager";
  const player = ctx.player || "a player";
  switch (event) {
    case "market_add":
      return `${team} signed ${player}${ctx.country ? ` (${ctx.country})` : ""}.`;
    case "market_release":
      return `${team} released ${player}.`;
    default:
      return null;
  }
}
