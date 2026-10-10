import { hostnameOf } from "@/lib/ultima/host";

export const WATCHWITH_APP_HOST = "watchwith.thereflectivefootball.com";

const STATIC_FILE = /\.(?:svg|png|jpe?g|gif|webp|avif|ico|css|m?js|map|json|txt|xml|woff2?|ttf|otf|mp4|webm|pdf)$/i;
const CLUB_PATH = /^\/([a-z0-9-]+)(\/ranking)?$/;
const LONG_PATH = /^\/watch-with\/([a-z0-9-]+)(\/ranking)?$/;

export function isWatchWithHost(host) {
  const name = hostnameOf(host);
  return name === WATCHWITH_APP_HOST || name === "watchwith.localhost";
}

export function shareLabel(club) {
  return `${WATCHWITH_APP_HOST}/${club}`;
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
 * "/" is the club picker. "/west-ham" is that club. "/west-ham/ranking" is its ranking.
 */
export function watchWithHostAction(pathname) {
  const path = pathname || "/";
  if (isWatchWithPassthrough(path)) return { type: "pass" };
  if (path === "/") return { type: "rewrite", to: "/watch-with" };
  if (path === "/watch-with") return { type: "redirect", to: "/", keepSearch: true };
  if (path === "/ranking") return { type: "redirect", to: "/west-ham/ranking", keepSearch: true };

  const long = path.match(LONG_PATH);
  if (long) return { type: "redirect", to: `/${long[1]}${long[2] || ""}`, keepSearch: true };

  const short = path.match(CLUB_PATH);
  if (short) return { type: "rewrite", to: `/watch-with/${short[1]}${short[2] || ""}` };
  return { type: "pass" };
}

/** Root-relative links. Short on the watch-with host, full paths on the main site. */
export function watchWithPaths(host, club) {
  if (isWatchWithHost(host)) {
    return { hub: "/", game: `/${club}`, ranking: `/${club}/ranking` };
  }
  return { hub: "/watch-with", game: `/watch-with/${club}`, ranking: `/watch-with/${club}/ranking` };
}
