export const ULTIMA_APP_HOST = "ultima.thereflectivefootball.com";
export const ULTIMA_APP_URL = `https://${ULTIMA_APP_HOST}`;

const AUTH_PARENT_DOMAIN = ".thereflectivefootball.com";

export function hostnameOf(host) {
  return String(host ?? "")
    .split(":")[0]
    .trim()
    .toLowerCase();
}

export function isUltimaAppHost(host) {
  const name = hostnameOf(host);
  return name === ULTIMA_APP_HOST || name === "ultima.localhost";
}

export function shareAuthCookieDomain(host) {
  const name = hostnameOf(host);
  return name === "thereflectivefootball.com" || name.endsWith(".thereflectivefootball.com");
}

export function withAuthCookieDomain(options = {}, host) {
  const next = { path: "/", ...options };
  if (shareAuthCookieDomain(host)) {
    next.domain = AUTH_PARENT_DOMAIN;
    next.secure = true;
    if (!next.sameSite) next.sameSite = "lax";
  }
  return next;
}

const ULTIMA_APP_LEAVES = [
  "/draft",
  "/squad",
  "/join",
  "/rules",
  "/market",
  "/trades",
  "/practice",
  "/standings",
  "/profile",
  "/admin",
  "/log",
  "/sample",
];

export function isUltimaAppLeaf(pathname) {
  return ULTIMA_APP_LEAVES.some(
    (leaf) => pathname === leaf || pathname.startsWith(`${leaf}/`),
  );
}

/** Map a subdomain URL (`/squad`) onto the App Router path (`/ultima/squad`). */
export function ultimaCanonicalPath(pathname) {
  const path = String(pathname ?? "");
  if (!path || path === "/") return "/ultima";
  if (path === "/ultima" || path.startsWith("/ultima/")) return path;
  if (isUltimaAppLeaf(path)) return `/ultima${path}`;
  return path;
}

export function isUltimaPassthrough(pathname) {
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/brand")) return true;
  if (pathname.startsWith("/api")) return true;
  if (pathname.startsWith("/auth")) return true;
  if (pathname === "/signin" || pathname.startsWith("/signin/")) return true;
  if (pathname === "/welcome" || pathname.startsWith("/welcome/")) return true;
  if (pathname === "/offline") return true;
  if (pathname === "/sw.js" || pathname.startsWith("/swe-worker")) return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname === "/ultima" || pathname.startsWith("/ultima/")) return true;
  if (pathname === "/manifest.webmanifest" || pathname === "/manifest.json") {
    return true;
  }
  return false;
}
