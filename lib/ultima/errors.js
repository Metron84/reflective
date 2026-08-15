/** User-facing error lines from spec section 15.6 / 16.6. */
export const ULTIMA_ERRORS = {
  PICK_TAKEN: "That pick did not land. Someone took him first. Pick again.",
  NOT_YOUR_TURN: "Not your turn. The clock belongs to someone else.",
  FLOOR_IMPOSSIBLE:
    "That pick would make the league floor impossible. Choose again.",
  LEAGUE_LOCKED: "That league is live. Those slots are set.",
  SQUAD_FULL: "Your squad is full. Drop someone first.",
  FLOOR_VIOLATION: "That move breaks a league floor. Check your counts.",
  INVITE_INVALID: "That code is not valid. Ask the commissioner.",
  INVITE_EXPIRED: "That invite has expired. Ask the commissioner.",
  LEAGUE_FULL: "All ten seats are taken. Ask the commissioner about next season.",
  TRADE_UNEVEN: "That trade is not even. Adjust the players.",
  TRADE_TOO_EARLY: "Trades open at gameweek 4.",
  NOT_COMMISSIONER: "Commissioner action only.",
  DRAFT_STARTED:
    "The draft has started. Ask the commissioner about next season.",
  PROFILE_INCOMPLETE: "Complete your profile before entering the draft room.",
  SIGN_IN_REQUIRED: "Sign in to join Ultima.",
  POOL_EMPTY:
    "No players in the pool yet. The commissioner needs to sync players before the draft can start.",
  UNAVAILABLE: "Ultima is not available right now. Try again shortly.",
};

export function ultimaErrorResponse(code, { field = null, status = 400 } = {}) {
  const message = ULTIMA_ERRORS[code] ?? ULTIMA_ERRORS.UNAVAILABLE;
  return {
    status,
    body: { code, message, field },
  };
}
