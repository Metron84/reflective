import { stringFromBase64URL } from "@supabase/ssr";

const BASE64_PREFIX = "base64-";

/** Name of the cookie @supabase/ssr stores the session under. */
export function authCookieKey(supabaseUrl) {
  return `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
}

/**
 * Read the access token from the request cookies without touching the Auth
 * server. Returns null when there is no session cookie or it cannot be read.
 * @param {{ name: string, value: string }[]} allCookies
 */
export function accessTokenFromCookies(allCookies, supabaseUrl) {
  try {
    const key = authCookieKey(supabaseUrl);
    const byName = new Map(allCookies.map((c) => [c.name, c.value]));
    let raw = byName.get(key) || null;
    if (!raw) {
      const parts = [];
      for (let i = 0; byName.get(`${key}.${i}`); i += 1) parts.push(byName.get(`${key}.${i}`));
      raw = parts.length ? parts.join("") : null;
    }
    if (!raw) return null;
    const json = raw.startsWith(BASE64_PREFIX)
      ? stringFromBase64URL(raw.substring(BASE64_PREFIX.length))
      : raw;
    const token = JSON.parse(json)?.access_token;
    return typeof token === "string" && token ? token : null;
  } catch {
    return null;
  }
}
