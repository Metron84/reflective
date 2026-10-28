import { hostAction } from "@/lib/hosts";
import { hostnameOf } from "@/lib/ultima/host";

export const WATCHWITH_APP_HOST = "watchwith.thereflectivefootball.com";

export function isWatchWithHost(host) {
  const name = hostnameOf(host);
  return name === WATCHWITH_APP_HOST || name === "watchwith.localhost";
}

export function shareLabel(club) {
  return `${WATCHWITH_APP_HOST}/${club}`;
}

export function watchWithHostAction(pathname) {
  return hostAction(WATCHWITH_APP_HOST, pathname);
}

/** Root-relative links. Short on the watch-with host, full paths on the main site. */
export function watchWithPaths(host, club) {
  if (isWatchWithHost(host)) {
    return { hub: "/", game: `/${club}`, ranking: `/${club}/ranking` };
  }
  return { hub: "/watch-with", game: `/watch-with/${club}`, ranking: `/watch-with/${club}/ranking` };
}
