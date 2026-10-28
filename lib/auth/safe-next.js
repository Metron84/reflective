/**
 * A return target is a site path, or an absolute URL on our own hosts.
 * Anything else falls back, so ?next cannot leave The Reflective Football.
 */
export function isAllowedReturnHost(hostname) {
  const host = String(hostname ?? "")
    .replace(/:\d+$/, "")
    .trim()
    .toLowerCase();
  if (!host || host.includes("..")) return false;
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host === "thereflectivefootball.com") return true;
  return host.endsWith(".thereflectivefootball.com");
}

function safePath(next) {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//")) return null;
  if (next.includes("\\") || /[\u0000-\u001f]/.test(next)) return null;
  try {
    const base = "http://local.invalid";
    const url = new URL(next, base);
    if (url.origin !== base) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function safeNextPath(next, fallback = "/") {
  if (typeof next !== "string") return fallback;
  const value = next.trim();
  const path = safePath(value);
  if (path) return path;
  try {
    const url = new URL(value);
    const local = url.hostname === "localhost" || url.hostname.endsWith(".localhost");
    if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) return fallback;
    if (!isAllowedReturnHost(url.hostname)) return fallback;
    return url.toString();
  } catch {
    return fallback;
  }
}
