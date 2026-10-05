/** One-line receipts for confirmed writes. Short, plain, no em-dashes. */

/** "just now", "3 min ago", "2 h ago", "4 d ago". */
export function agoLabel(iso, now = Date.now()) {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return null;
  const secs = Math.max(0, Math.floor((now - then) / 1000));
  if (secs < 45) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

/** The refusal for a player someone else already holds: who, and when. */
export function takenLine({ takenBy, takenAt }, now = Date.now()) {
  const who = takenBy || "Another club";
  const when = takenAt ? agoLabel(takenAt, now) : null;
  return when ? `${who} signed him ${when}.` : `${who} signed him first.`;
}

export const SIGN_RECEIPT_ACTIONS = ["sign", "drop_sign"];

export function signReceipt({ added, dropped }) {
  if (added && dropped) return `Signed ${added}, released ${dropped}`;
  if (added) return `Signed ${added}`;
  if (dropped) return `Released ${dropped}`;
  return "Squad updated";
}

export function offerSentReceipt({ team, hours = 48 }) {
  return `Offer sent to ${team || "the other club"}, expires in ${hours}h`;
}

export function tradeResponseReceipt({ kind, state, vetoed, votes }) {
  if (kind === "cancel") return "Offer withdrawn";
  if (kind === "veto") return vetoed ? "Veto cast. The deal is off" : `Veto cast${votes != null ? `, ${votes} so far` : ""}`;
  if (state === "declined") return "Offer declined";
  if (state === "review") return "Offer accepted. League review is open";
  return "Done";
}

/** Receipt for one player-card action. `name` is the player's name. */
export function cardActionReceipt({ action, name, result = {} }) {
  const who = name || "Player";
  switch (action) {
    case "sign":
    case "drop_sign":
      return signReceipt({ added: result.added, dropped: result.dropped });
    case "captain_on":
      return `${who} is captain`;
    case "captain_off":
      return `${who} is no longer captain`;
    case "xv_in":
      return `${who} starts`;
    case "xv_out":
      return `${who} moved to the bench`;
    case "shortlist_on":
      return `${who} added to your shortlist`;
    case "shortlist_off":
      return `${who} removed from your shortlist`;
    case "untouchable_on":
      return `${who} is untouchable`;
    case "untouchable_off":
      return `${who} is open to offers`;
    case "list":
      return `${who} listed on the block`;
    case "unlist":
      return `${who} off the block`;
    default:
      return "Done";
  }
}

export function lineupReceipt() {
  return "Lineup saved";
}

export function captainReceipt({ name }) {
  return `${name || "Player"} is captain`;
}
