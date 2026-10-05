/** Sportmonks transfer type: temporary move; player sits in the borrowing squad. */
export const LOAN_TRANSFER_TYPE = 218;

/** Only loans dated on or after the 2026/27 window open count. */
export const LOAN_MIN_DATE = "2026-07-01";

function clubKey(name) {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function transferDate(transfer) {
  const raw = transfer?.date ?? transfer?.completed_at ?? null;
  if (!raw) return null;
  const day = String(raw).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

function parentClubName(transfer) {
  const name =
    transfer?.fromteam?.name ??
    transfer?.from_team?.name ??
    transfer?.fromTeam?.name ??
    transfer?.from?.name ??
    null;
  if (typeof name !== "string") return null;
  const trimmed = name.trim();
  return trimmed || null;
}

/**
 * on_loan only when the active transfer is type 218, dated on/after 1 Jul 2026,
 * and the from-team is known and differs from the current club. No parent → no loan.
 */
export function resolveLoanMeta(transfer, currentClub) {
  if (!transfer) return { on_loan: false, parent_club: null };

  const typeId = Number(transfer.type_id ?? transfer.type?.id ?? transfer.type?.type_id);
  if (typeId !== LOAN_TRANSFER_TYPE) return { on_loan: false, parent_club: null };

  const date = transferDate(transfer);
  if (!date || date < LOAN_MIN_DATE) return { on_loan: false, parent_club: null };

  const parent = parentClubName(transfer);
  if (!parent) return { on_loan: false, parent_club: null };

  const club = clubKey(currentClub);
  if (!club || clubKey(parent) === club) return { on_loan: false, parent_club: null };

  return { on_loan: true, parent_club: parent };
}
