import { HUB_ORIGIN, appForHost, hostAction, isHostPassthrough } from "@/lib/hosts";
import { hostnameOf } from "@/lib/ultima/host";

export const PLAY_APP_HOST = "play.thereflectivefootball.com";

export function isPlayHost(host) {
  return appForHost(host)?.slug === "play";
}

/** @param {string} pathname */
export function isPlayPassthrough(pathname) {
  return isHostPassthrough(pathname);
}

/**
 * What the play host does with a request path.
 * pass: serve as is. rewrite: serve `to` under the same URL.
 *
 * @param {string} pathname
 */
export function playHostAction(pathname) {
  return hostAction(PLAY_APP_HOST, pathname);
}

/** Where the site's other pages live, for links shown on the play host. */
export function mainSiteOrigin(host) {
  const name = hostnameOf(host);
  if (name === "localhost" || name.endsWith(".localhost")) {
    const port = String(host ?? "").split(":")[1];
    return `http://localhost${port ? `:${port}` : ""}`;
  }
  return HUB_ORIGIN;
}

/** Sign-in link that brings the player back to the same host with the save flag. */
export function signInHrefFor(host) {
  const next = isPlayHost(host) ? "/?save=1" : "/play?save=1";
  return `/signin?next=${encodeURIComponent(next)}`;
}
