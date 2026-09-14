export const FATF_PATH = "/for-all-the-fans";
export const FATF_SIGNUP_SOURCE = "for-all-the-fans";
export const FATF_CONSENT_VERSION = "fatf-nights-2026-09";
export const FATF_PENDING_COOKIE = "trf_fatf_pending";

export const FATF_META_DESCRIPTION =
  "One night a month, the room goes to the people who work every matchday. Register your interest with The Reflective Football.";

export const FATF_CONSENT_LINE =
  "I agree that The Reflective Football can email me about For All The Fans nights. I can ask to be removed at any time.";

export const FATF_ROLES = [
  { id: "work", label: "I work matchdays" },
  { id: "venue", label: "I run a venue" },
  { id: "club", label: "I run a supporters club" },
  { id: "fan", label: "I am a fan" },
];

export const FATF_EVENTS = [
  "fatf_page_view",
  "fatf_interest_click",
  "fatf_interest_complete",
  "fatf_role_selected",
  "fatf_role_skipped",
];

/** @param {unknown} path */
export function isFatfNext(path) {
  if (typeof path !== "string") return false;
  const bare = path.split("?")[0];
  return bare === FATF_PATH;
}

/** @param {unknown} value */
export function normalizeFatfRole(value) {
  if (typeof value !== "string") return null;
  return FATF_ROLES.some((role) => role.id === value) ? value : null;
}

export function fatfSignInHref() {
  return `/signin?next=${encodeURIComponent(FATF_PATH)}&intent=fatf`;
}
