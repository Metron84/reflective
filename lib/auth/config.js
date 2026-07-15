export function isGoogleAuthEnabled() {
  return process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";
}

export function formatMemberNumber(memberNumber) {
  const n = Number(memberNumber);
  if (!Number.isFinite(n) || n < 1) return "#0001";
  return `#${String(Math.floor(n)).padStart(4, "0")}`;
}

export function defaultNameFromEmail(email) {
  if (!email) return "Fan";
  const prefix = email.split("@")[0]?.trim();
  if (!prefix) return "Fan";
  return prefix.charAt(0).toUpperCase() + prefix.slice(1);
}
