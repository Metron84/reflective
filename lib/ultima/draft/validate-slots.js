/**
 * Before a season draft starts with its lobby order kept, every seated manager
 * (human or bot) must hold a draft slot, and the slots must be exactly 1..N.
 * Pure. Rows are { draft_slot }.
 */
export function validateDraftSlots(managers) {
  const rows = managers ?? [];
  const count = rows.length;
  if (!count) return { ok: false, count, reason: "no managers are seated" };

  const slots = rows.map((m) => m.draft_slot);
  if (slots.some((slot) => !Number.isInteger(slot))) {
    return { ok: false, count, reason: "a seat has no draft slot" };
  }

  const sorted = [...slots].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i += 1) {
    if (sorted[i] === i + 1) continue;
    return {
      ok: false,
      count,
      reason: i > 0 && sorted[i] === sorted[i - 1] ? `slot ${sorted[i]} is used twice` : `slot ${i + 1} is missing`,
    };
  }

  return { ok: true, count };
}
