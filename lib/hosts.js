import {
  appForSubdomain,
  isSubdomainPassthrough,
  manifestForSubdomain,
  subdomainAction,
  SUBDOMAINS,
} from "@/lib/subdomains";
import { hostnameOf } from "@/lib/ultima/host";

/** The public hub. Subdomain apps send people here when they leave their section. */
export const HUB_ORIGIN = "https://www.thereflectivefootball.com";

/**
 * One row per installable app. `slug` is the subdomain. `target` is the App
 * Router path that subdomain serves.
 */
export const HOST_MAP = Object.entries(SUBDOMAINS).map(([slug, app]) => ({
  slug,
  shortName: app.shortName,
  name: app.name,
  target: app.path,
  themeColor: app.themeColor,
  backgroundColor: app.backgroundColor,
}));

/**
 * Paths every app host serves as themselves. Auth stays here so a sign-in
 * started on a subdomain can finish on that same host.
 *
 * @param {string} pathname
 */
export function isHostPassthrough(pathname) {
  return isSubdomainPassthrough(pathname);
}

/**
 * @param {string|null|undefined} host
 * @returns {(typeof HOST_MAP)[number]|null}
 */
export function appForHost(host) {
  const found = appForSubdomain(host);
  if (!found) return null;
  return HOST_MAP.find((app) => app.slug === found.slug) || null;
}

/**
 * The site path this host should serve. Paths already inside the app are left alone.
 *
 * @param {string|null|undefined} host
 * @param {string} pathname
 */
export function hostAction(host, pathname) {
  return subdomainAction(host, pathname);
}

/**
 * Path on the hub that matches what this host is showing.
 *
 * @param {string|null|undefined} host
 * @param {string} pathname
 */
export function canonicalPath(host, pathname) {
  const app = appForHost(host);
  const path = pathname || "/";
  if (!app) return path;
  if (path === app.target || path.startsWith(`${app.target}/`)) return path;
  if (isHostPassthrough(path)) return path;
  return path === "/" ? app.target : `${app.target}${path}`;
}

/**
 * @param {string|null|undefined} host
 * @param {string} pathname
 * @returns {string|null} absolute canonical, or null on the hub
 */
export function canonicalUrl(host, pathname) {
  if (!appForHost(host)) return null;
  return `${HUB_ORIGIN}${canonicalPath(host, pathname)}`;
}

/**
 * A link that stays inside the app, or an absolute hub URL when it leaves.
 *
 * @param {string} path
 * @param {string|null|undefined} host
 */
/**
 * A same-site link. On an app host the middleware 307s a path that leaves the section.
 *
 * @param {string} path
 * @param {string|null|undefined} [_host]
 */
export function hubUrl(path, _host) {
  if (!path || path.startsWith("mailto:") || path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  return path.startsWith("/") ? path : `/${path}`;
}

/**
 * Where the auth callback sends the browser. Only our own hosts are allowed.
 *
 * @param {string|null|undefined} hintedHost
 * @param {string} fallbackOrigin
 */
export function returnOrigin(hintedHost, fallbackOrigin) {
  const raw = String(hintedHost ?? "").trim();
  const name = hostnameOf(raw);
  if (!isReturnHost(name)) return fallbackOrigin;
  const proto = name === "localhost" || name.endsWith(".localhost") ? "http" : "https";
  const port = raw.includes(":") ? raw.slice(raw.indexOf(":")) : "";
  return `${proto}://${name}${port}`;
}

/**
 * @param {string} name
 */
function isReturnHost(name) {
  if (!name) return false;
  if (name === "localhost" || name.endsWith(".localhost")) return true;
  if (name === "thereflectivefootball.com" || name === "www.thereflectivefootball.com") return true;
  return HOST_MAP.some((app) => name === `${app.slug}.thereflectivefootball.com`);
}

/**
 * Manifest fields for this host. `hasIcon` reports whether a public file exists.
 *
 * @param {string|null|undefined} host
 * @param {(src: string) => boolean} [hasIcon]
 */
export function manifestForHost(host, hasIcon = () => false) {
  return manifestForSubdomain(host, hasIcon);
}
