import { hostnameOf } from "@/lib/ultima/host";

export const OBSERVATORY_APP_HOST = "observatory.thereflectivefootball.com";

export function isObservatoryHost(host) {
  const name = hostnameOf(host);
  return name === OBSERVATORY_APP_HOST || name === "observatory.localhost";
}

/**
 * The observatory host keeps the short URL.
 * "/" serves /observatory. "/footballer-001" serves the study.
 * API, assets and the rest of the site pass through.
 */
export function observatoryHostAction(pathname) {
  const path = pathname || "/";
  if (path === "/") return { type: "rewrite", to: "/observatory" };
  if (path === "/footballer-001") return { type: "rewrite", to: "/observatory/footballer-001" };
  if (path === "/observatory") return { type: "redirect", to: "/", keepSearch: true };
  if (path === "/observatory/footballer-001") {
    return { type: "redirect", to: "/footballer-001", keepSearch: true };
  }
  return { type: "pass" };
}
