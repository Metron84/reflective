/**
 * Shared by the form (inline errors) and /api/clockend (the source of truth).
 * Returns E.164 or null.
 */
export function normalizeWhatsapp(raw) {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) return null;
  const international = text.startsWith("+") || text.startsWith("00");
  let digits = text.replace(/\D/g, "");
  if (text.startsWith("00")) digits = digits.slice(2);
  if (!digits) return null;

  let e164;
  if (international) {
    e164 = `+${digits}`;
  } else {
    const national = digits.replace(/^0+/, "");
    // People often type 971501234567 without the plus.
    e164 =
      national.startsWith("971") && national.length >= 11
        ? `+${national}`
        : `+971${national}`;
  }

  if (!/^\+[1-9]\d{7,14}$/.test(e164)) return null;
  if (e164.startsWith("+971") && !/^\+971\d{8,9}$/.test(e164)) return null;
  return e164;
}

/** Strips a leading @. Returns { value, valid }; value is null when empty. */
export function normalizeInstagram(raw) {
  const text = typeof raw === "string" ? raw.trim().replace(/^@+/, "") : "";
  if (!text) return { value: null, valid: true };
  const valid = /^[A-Za-z0-9._]{1,30}$/.test(text);
  return { value: valid ? text : null, valid };
}
