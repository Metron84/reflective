import { hostAction } from "@/lib/hosts";
import { hostnameOf } from "@/lib/ultima/host";

export const OBSERVATORY_APP_HOST = "observatory.thereflectivefootball.com";

export function isObservatoryHost(host) {
  const name = hostnameOf(host);
  return name === OBSERVATORY_APP_HOST || name === "observatory.localhost";
}

/**
 * @param {string} pathname
 */
export function observatoryHostAction(pathname) {
  return hostAction(OBSERVATORY_APP_HOST, pathname);
}
