/** User-facing error lines from spec section 15.6 / 16.6. */
export const ULTIMA_ERRORS = {
  PICK_TAKEN: "That pick did not land. Someone took him first. Pick again.",
  NOT_OWNED: "That player is not on your squad.",
  NOT_YOUR_TURN: "Not your turn. The clock belongs to someone else.",
  FLOOR_IMPOSSIBLE:
    "That pick would make the league floor impossible. Choose again.",
  LEAGUE_LOCKED: "That league is live. Those slots are set.",
  XV_LOCKED: "He's locked in your XV until Friday.",
  ALREADY_YOURS: "He is already on your squad.",
  IN_PROGRESS: "Still working on your last tap.",
  SQUAD_FULL: "Your squad is full. Drop someone first.",
  FLOOR_VIOLATION: "That move breaks a league floor. Check your counts.",
  INVITE_INVALID: "That code is not valid. Ask the commissioner.",
  INVITE_EXPIRED: "That invite has expired. Ask the commissioner.",
  LEAGUE_FULL: "All ten seats are taken. Ask the commissioner about next season.",
  TRADE_UNEVEN: "Trades must be the same number of players each way.",
  TRADE_DEADLINE: "The trade deadline has passed.",
  TRADE_EMPTY: "Pick at least one player on each side.",
  TRADE_DUPLICATE: "A player is listed twice. Check both sides.",
  TRADE_TOO_LATE: "Too late to accept. Review would end after the trade deadline.",
  TRADE_BOT: "Bots do not trade. Pick another manager.",
  TRADE_BUSY: "A player is already in another offer.",
  TRADE_LIMIT: "That is 20 offers today. Try again tomorrow.",
  TRADE_LIVE_OFFER: "You already have a live offer with that manager.",
  TRADE_CAP: "You have 3 live offers. Withdraw one first.",
  TRADE_FROZEN: "That player is already in an accepted deal.",
  TRADE_EXPIRED: "That offer expired.",
  IN_ACCEPTED_TRADE: "He is in an accepted deal. He stays until it settles.",
  UNTOUCHABLE: "That player is untouchable.",
  UNTOUCHABLE_LIMIT: "You can protect 3 players. Free a spot first.",
  TRADE_REVIEW_CLOSED: "The review has closed.",
  NOT_IN_XV: "Start him in your XV first.",
  CAPTAIN_LOCKED: "That country is live. Captains are set.",
  NO_GAMEWEEK: "No gameweek this week. The leagues are on a break.",
  CAPTAIN_UNAVAILABLE: "Captains open shortly. Try again soon.",
  NOT_COMMISSIONER: "Commissioner action only.",
  DRAFT_STARTED:
    "The draft has started. Ask the commissioner about next season.",
  PROFILE_INCOMPLETE: "Complete your profile before entering the draft room.",
  SIGN_IN_REQUIRED: "Sign in to join Ultima.",
  POOL_EMPTY:
    "No players in the pool yet. The commissioner needs to sync players before the draft can start.",
  TIERED_TIMER: "The season clock is fixed by round. It cannot be changed.",
  SEAT_UNAVAILABLE: "Couldn't load your seat. Try again.",
  NO_SEAT: "You do not have a seat in this season.",
  UNAVAILABLE: "Ultima is not available right now. Try again shortly.",
};

export function ultimaErrorResponse(code, { field = null, status = 400, message = null } = {}) {
  return {
    status,
    body: { code, message: message || ULTIMA_ERRORS[code] || ULTIMA_ERRORS.UNAVAILABLE, field },
  };
}
