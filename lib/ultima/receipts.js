import { LIVE_OFFER_HOURS } from "@/lib/ultima/trades/rules";

/**
 * One-line receipts for confirmed writes. The server builds them from what it
 * just wrote, so the toast states exactly what changed. No em-dashes.
 */

const nameOf = (value) => (typeof value === "string" ? value : value?.name) || "";

export function signedReceipt({ added, dropped } = {}) {
  const add = nameOf(added);
  const drop = nameOf(dropped);
  if (add && drop) return `Signed ${add}, released ${drop}`;
  if (add) return `Signed ${add}`;
  if (drop) return `Released ${drop}`;
  return "Squad updated";
}

export function offerSentReceipt({ team, counter = false } = {}) {
  const to = team || "the other club";
  return `${counter ? "Counter" : "Offer"} sent to ${to}, expires in ${LIVE_OFFER_HOURS}h`;
}

export function offerAcceptedReceipt({ team } = {}) {
  return team
    ? `Accepted the offer from ${team}, league review is open`
    : "Accepted, league review is open";
}

export function offerDeclinedReceipt({ team } = {}) {
  return team ? `Declined the offer from ${team}` : "Offer declined";
}

export function offerCancelledReceipt({ team } = {}) {
  return team ? `Withdrew your offer to ${team}` : "Offer withdrawn";
}

export function vetoReceipt({ vetoed = false, votes = null } = {}) {
  if (vetoed) return "Veto cast, the deal is off";
  return votes ? `Veto cast, ${votes} so far` : "Veto cast";
}

export function xvSavedReceipt({ filled, size = 15 } = {}) {
  return Number.isFinite(filled) ? `XV saved, ${filled} of ${size} set` : "XV saved";
}

export function startedReceipt({ player } = {}) {
  return player ? `Started ${nameOf(player)}` : "XV updated";
}

export function benchedReceipt({ player } = {}) {
  return player ? `Benched ${nameOf(player)}` : "XV updated";
}

export function captainReceipt({ player } = {}) {
  return player ? `${nameOf(player)} is captain` : "Captain set";
}

export function captainOffReceipt({ player } = {}) {
  return player ? `${nameOf(player)} is no longer captain` : "Captain removed";
}

/** "Signed by X 3 min ago." The one line a lost race shows. */
export function takenLine({ takenBy, takenAt, now = Date.now() } = {}) {
  const who = takenBy || "another club";
  const at = takenAt ? new Date(takenAt).getTime() : NaN;
  if (!Number.isFinite(at)) return `Signed by ${who}.`;
  const minutes = Math.floor((now - at) / 60_000);
  if (minutes < 1) return `Signed by ${who} just now.`;
  if (minutes < 60) return `Signed by ${who} ${minutes} min ago.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Signed by ${who} ${hours}h ago.`;
  return `Signed by ${who} ${Math.floor(hours / 24)}d ago.`;
}
