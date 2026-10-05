import { ULTIMA_LEAGUES, ULTIMA_SQUAD_FLOOR_PER_LEAGUE } from "../constants.js";
import { floorMessage, floorShortfall } from "../trades/rules.js";
import {
  FROZEN_LINE,
  LIVE_CAP_LINE,
  LIVE_OFFER_CAP,
  UNTOUCHABLE_LINE,
  UNTOUCHABLE_MAX,
} from "../trades/rules.js";

/**
 * Pure rules for the player card and the who-goes list. No database, no clock.
 * The server gathers the facts; these functions say what the card shows and
 * which actions stay enabled. A move that cannot be done stays visible and
 * disabled, with the reason in plain words.
 */

export const CARD_LINES = {
  XV_LOCKED: "He's locked in your XV until Friday.",
  SLOTS_LOCKED: "That country is live. Slots are set.",
  CAPTAIN_LOCKED: "That country is live. Captains are set.",
  NOT_IN_XV: "Start him in your XV first.",
  XV_FULL: "Your XV is full in that country. Bench someone first.",
  CAPTAIN_CARRIED: "Make another player captain to replace him.",
  NO_GAMEWEEK: "No gameweek this week. The leagues are on a break.",
  FROZEN_RELEASE: "He is in an accepted deal. He stays until it settles.",
  UNTOUCHABLE_LIMIT: "You can protect 3 players. Free a spot first.",
  UNTOUCHABLE_NO_LIST: "Untouchable players stay off the list.",
  MARKET_CLOSED: "Free agents open after the draft completes.",
  DEADLINE: "The trade deadline has passed.",
  PAIR_SENT: "You already have a live offer with them.",
  PAIR_RECEIVED: "They sent you an offer. Counter it on the Trades page.",
  NOTE_MAX: 80,
};

/** Chips in the order the card shows them. */
export function buildChips(facts) {
  const chips = [];
  if (facts.captain) chips.push({ id: "captain", label: "Captain" });
  if (facts.inXv) chips.push({ id: "xv", label: "In XV" });
  if (facts.listed) chips.push({ id: "listed", label: "Transfer listed" });
  if (facts.untouchable) chips.push({ id: "untouchable", label: "Untouchable" });
  if (facts.locked) chips.push({ id: "locked", label: "Locked" });
  if (facts.frozen) chips.push({ id: "frozen", label: "In accepted deal" });
  if (facts.liveOffers > 0) {
    chips.push({
      id: "offers",
      label: `In ${facts.liveOffers} live ${facts.liveOffers === 1 ? "offer" : "offers"}`,
    });
  }
  if (facts.movedFrom) chips.push({ id: "moved", label: `Moved from ${facts.movedFrom}` });
  return chips;
}

function action(id, label, { primary = false, reason = null } = {}) {
  return { id, label, primary, disabled: Boolean(reason), reason: reason ?? null };
}

/**
 * Actions by owner. `facts.kind` is "mine", "human", "bot" or "free".
 * Order is the order the card shows them. The primary action comes first.
 */
export function buildActions(facts) {
  const out = [];

  if (facts.kind === "free") {
    out.push(
      action("sign", "Add to squad", {
        primary: true,
        reason: facts.marketOpen ? null : CARD_LINES.MARKET_CLOSED,
      }),
    );
    out.push(shortlistAction(facts));
    return out;
  }

  if (facts.kind === "bot") {
    out.push(shortlistAction(facts));
    return out;
  }

  if (facts.kind === "human") {
    let reason = null;
    if (!facts.tradesOpen) reason = CARD_LINES.DEADLINE;
    else if (facts.untouchable) reason = UNTOUCHABLE_LINE;
    else if (facts.frozen) reason = FROZEN_LINE;
    else if (facts.liveOutgoing >= LIVE_OFFER_CAP) reason = LIVE_CAP_LINE;
    else if (facts.pairLive === "sent") reason = CARD_LINES.PAIR_SENT;
    else if (facts.pairLive === "received") reason = CARD_LINES.PAIR_RECEIVED;
    out.push(action("offer", "Make offer", { primary: true, reason }));
    out.push(shortlistAction(facts));
    return out;
  }

  // Mine.
  const noGw = !facts.hasGameweek;
  if (facts.captain) {
    out.push(
      action("captain_off", "Remove captain", {
        reason: noGw
          ? CARD_LINES.NO_GAMEWEEK
          : facts.slotLocked
            ? CARD_LINES.CAPTAIN_LOCKED
            : facts.captainCarried
              ? CARD_LINES.CAPTAIN_CARRIED
              : null,
      }),
    );
  } else {
    out.push(
      action("captain_on", "Make captain", {
        primary: facts.inXv && !facts.slotLocked,
        reason: noGw
          ? CARD_LINES.NO_GAMEWEEK
          : !facts.inXv
            ? CARD_LINES.NOT_IN_XV
            : facts.slotLocked
              ? CARD_LINES.CAPTAIN_LOCKED
              : null,
      }),
    );
  }

  if (facts.inXv) {
    out.push(
      action("xv_out", "Move to bench", {
        reason: noGw ? CARD_LINES.NO_GAMEWEEK : facts.slotLocked ? CARD_LINES.XV_LOCKED : null,
      }),
    );
  } else {
    out.push(
      action("xv_in", "Move to XV", {
        primary: !facts.captain,
        reason: noGw
          ? CARD_LINES.NO_GAMEWEEK
          : facts.countryLocked
            ? CARD_LINES.SLOTS_LOCKED
            : facts.xvFull
              ? CARD_LINES.XV_FULL
              : null,
      }),
    );
  }

  out.push(
    facts.listed
      ? action("unlist", "Remove from transfer list")
      : action("list", "Transfer list", {
          reason: facts.untouchable ? CARD_LINES.UNTOUCHABLE_NO_LIST : null,
        }),
  );

  out.push(
    facts.untouchable
      ? action("untouchable_off", "Remove untouchable")
      : action("untouchable_on", "Untouchable", {
          reason: facts.untouchableCount >= UNTOUCHABLE_MAX ? CARD_LINES.UNTOUCHABLE_LIMIT : null,
        }),
  );

  out.push(
    action("offer_mine", "Offer in a trade", {
      reason: !facts.tradesOpen
        ? CARD_LINES.DEADLINE
        : facts.frozen
          ? FROZEN_LINE
          : facts.liveOutgoing >= LIVE_OFFER_CAP
            ? LIVE_CAP_LINE
            : null,
    }),
  );

  out.push(
    action("drop_sign", "Drop and sign", {
      reason: !facts.marketOpen
        ? CARD_LINES.MARKET_CLOSED
        : facts.frozen
          ? CARD_LINES.FROZEN_RELEASE
          : facts.slotLocked
            ? CARD_LINES.XV_LOCKED
            : null,
    }),
  );
  return out;
}

function shortlistAction(facts) {
  return facts.shortlisted
    ? action("shortlist_off", "Remove from shortlist")
    : action("shortlist_on", "Add to shortlist");
}

// ---------------------------------------------------------------------------
// Who goes, and who comes in
// ---------------------------------------------------------------------------

/**
 * Can this player be released? A locked XV slot and an accepted deal say no.
 * Returns a plain reason or null.
 */
export function releaseBlock({ playerId, lockedXvIds = [], frozenIds = [] }) {
  if ((frozenIds ?? []).includes(playerId)) return CARD_LINES.FROZEN_RELEASE;
  if ((lockedXvIds ?? []).includes(playerId)) return CARD_LINES.XV_LOCKED;
  return null;
}

/**
 * The "pick who goes" list.
 *
 * mode "add": `subject` is the free agent coming in, `candidates` is my squad.
 * mode "drop": `subject` is my player leaving, `candidates` is the free agents.
 *
 * Same country first. Another country only if my squad stays at 3 or more
 * there: a move that deepens a floor gap is listed as "Can't" with the reason.
 * In "add" mode a locked XV slot or an accepted deal is also "Can't".
 *
 * @returns {Array<{ player: object, can: boolean, reason: string|null, sameCountry: boolean, voids: string[] }>}
 */
export function buildSwapList({
  mode,
  roster,
  subject,
  candidates,
  lockedXvIds = [],
  frozenIds = [],
  liveOfferTeams = new Map(),
  shortlistIds = [],
  score = () => 0,
  floor = ULTIMA_SQUAD_FLOOR_PER_LEAGUE,
}) {
  const shortlist = new Set(shortlistIds ?? []);
  const rows = (candidates ?? [])
    .filter((c) => c.id !== subject.id)
    .map((candidate) => {
      const leaving = mode === "add" ? candidate : subject;
      const incoming = mode === "add" ? subject : candidate;
      let reason = null;

      if (mode === "add") {
        reason = releaseBlock({ playerId: candidate.id, lockedXvIds, frozenIds });
      }
      if (!reason) {
        const short = floorShortfall(roster, [leaving.id], [incoming], floor);
        if (short) reason = floorMessage(short, { you: true });
      }

      return {
        player: candidate,
        can: !reason,
        reason,
        sameCountry: candidate.league === subject.league,
        shortlisted: shortlist.has(candidate.id),
        voids: mode === "add" ? (liveOfferTeams.get(candidate.id) ?? []) : [],
      };
    });

  const group = (row) => (row.sameCountry ? 0 : 1);
  const order = mode === "add" ? 1 : -1; // release the weakest first, sign the strongest first
  rows.sort((a, b) => {
    if (group(a) !== group(b)) return group(a) - group(b);
    if (a.can !== b.can) return a.can ? -1 : 1;
    if (a.shortlisted !== b.shortlisted) return a.shortlisted ? -1 : 1;
    return order * (score(a.player) - score(b.player));
  });
  return rows;
}

/** Country tags a squad is short in, for a one-line summary. */
export function squadLeagueCountsOf(roster) {
  const counts = Object.fromEntries(ULTIMA_LEAGUES.map((l) => [l, 0]));
  for (const player of roster ?? []) {
    if (player.league in counts) counts[player.league] += 1;
  }
  return counts;
}

/** Note for a transfer listing: trimmed to 80, links dropped. Null when empty. */
export function cleanListNote(value) {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim().slice(0, CARD_LINES.NOTE_MAX);
  if (!text || /https?:\/\//i.test(text)) return null;
  return text;
}
