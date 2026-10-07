import { SITE_URL } from "@/lib/config";
import { hostnameOf } from "@/lib/ultima/host";

export const PLAY_APP_HOST = "play.thereflectivefootball.com";

export function isPlayHost(host) {
  const name = hostnameOf(host);
  return name === PLAY_APP_HOST || name === "play.localhost";
}

const STATIC_FILE = /\.(?:svg|png|jpe?g|gif|webp|avif|ico|css|m?js|map|json|txt|xml|woff2?|ttf|otf|mp4|webm|pdf)$/i;

/** Paths the play host serves as they are: the game API, sign-in and static assets. */
export function isPlayPassthrough(pathname) {
  if (pathname.startsWith("/_next/")) return true;
  if (pathname.startsWith("/brand/")) return true;
  if (pathname === "/api/play" || pathname.startsWith("/api/play/")) return true;
  if (pathname === "/auth" || pathname.startsWith("/auth/")) return true;
  if (pathname === "/signin" || pathname.startsWith("/signin/")) return true;
  // New members land here after their first sign-in, then continue to `next`.
  if (pathname === "/welcome" || pathname.startsWith("/welcome/")) return true;
  if (pathname === "/offline") return true;
  if (pathname === "/sw.js" || pathname.startsWith("/swe-worker-")) return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname === "/manifest.webmanifest" || pathname === "/manifest.json") return true;
  return STATIC_FILE.test(pathname);
}

/**
 * What the play host does with a request path.
 * pass: serve as is. rewrite: serve `to` under the same URL. redirect: send the browser to `to`.
 */
export function playHostAction(pathname) {
  const path = pathname || "/";
  if (isPlayPassthrough(path)) return { type: "pass" };
  if (path === "/") return { type: "rewrite", to: "/play" };
  // The old main-site path keeps its query, so a bookmarked /play?save=1 still saves.
  if (path === "/play") return { type: "redirect", to: "/", keepSearch: true };
  return { type: "redirect", to: "/", keepSearch: false };
}

/** Where the site's other pages live, for links shown on the play host. */
export function mainSiteOrigin(host) {
  const name = hostnameOf(host);
  if (name.endsWith(".localhost")) {
    const port = String(host ?? "").split(":")[1];
    return `http://localhost${port ? `:${port}` : ""}`;
  }
  return SITE_URL;
}

/** Sign-in link that brings the player back to the same host with the save flag. */
export function signInHrefFor(host) {
  const next = isPlayHost(host) ? "/?save=1" : "/play?save=1";
  return `/signin?next=${encodeURIComponent(next)}`;
}
