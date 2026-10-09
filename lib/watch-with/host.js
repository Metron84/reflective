import { hostnameOf } from "@/lib/ultima/host";

export const WATCHWITH_APP_HOST = "watchwith.thereflectivefootball.com";
export const WATCHWITH_SHARE_LABEL = WATCHWITH_APP_HOST;

const STATIC_FILE = /\.(?:svg|png|jpe?g|gif|webp|avif|ico|css|m?js|map|json|txt|xml|woff2?|ttf|otf|mp4|webm|pdf)$/i;

export function isWatchWithHost(host) {
  const name = hostnameOf(host);
  return name === WATCHWITH_APP_HOST || name === "watchwith.localhost";
}

/** API, Next assets and static files stay on the short host as themselves. */
export function isWatchWithPassthrough(pathname) {
  if (pathname === "/api" || pathname.startsWith("/api/")) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname.startsWith("/brand/")) return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname === "/sw.js" || pathname.startsWith("/swe-worker")) return true;
  return STATIC_FILE.test(pathname);
}

/**
 * The watch-with host keeps the short URL.
 * "/" serves the West Ham game. "/ranking" serves its ranking.
 */
export function watchWithHostAction(pathname) {
  const path = pathname || "/";
  if (isWatchWithPassthrough(path)) return { type: "pass" };
  if (path === "/") return { type: "rewrite", to: "/watch-with/west-ham" };
  if (path === "/ranking") return { type: "rewrite", to: "/watch-with/west-ham/ranking" };
  if (path === "/watch-with/west-ham") return { type: "redirect", to: "/", keepSearch: true };
  if (path === "/watch-with/west-ham/ranking") return { type: "redirect", to: "/ranking", keepSearch: true };
  return { type: "pass" };
}

/** Root-relative links. Short on the watch-with host, full paths on the main site. */
export function watchWithPaths(host, club) {
  if (isWatchWithHost(host)) return { game: "/", ranking: "/ranking" };
  return { game: `/watch-with/${club}`, ranking: `/watch-with/${club}/ranking` };
}
