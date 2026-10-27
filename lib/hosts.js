import { hostnameOf } from "@/lib/ultima/host";

/** The public hub. Subdomain apps send people here when they leave their section. */
export const HUB_ORIGIN = "https://www.thereflectivefootball.com";

/**
 * One row per installable app. `slug` is the subdomain. `target` is the App
 * Router path that subdomain serves.
 */
export const HOST_MAP = [
  { slug: "play", shortName: "Fan Quiz", name: "Fan Quiz", target: "/play" },
  {
    slug: "ultima",
    shortName: "Ultima",
    name: "Ultima",
    target: "/ultima",
    themeColor: "#12151C",
    backgroundColor: "#12151C",
  },
  { slug: "codemaster", shortName: "Codemaster", name: "Codemaster", target: "/codemaster" },
  { slug: "guesser", shortName: "Guesser", name: "Guesser", target: "/guesser" },
  { slug: "crest", shortName: "The Crest", name: "The Crest", target: "/crest" },
  { slug: "concierge", shortName: "Concierge", name: "Concierge", target: "/concierge" },
  { slug: "events", shortName: "TRF Events", name: "TRF Events", target: "/events" },
  { slug: "compete", shortName: "Compete", name: "Compete", target: "/compete" },
  { slug: "observatory", shortName: "Observatory", name: "Observatory", target: "/observatory" },
  { slug: "watchwith", shortName: "Watch With", name: "Watch With", target: "/watch-with" },
];

const STATIC_FILE = /\.(?:svg|png|jpe?g|gif|webp|avif|ico|css|m?js|map|json|txt|xml|woff2?|ttf|otf|mp4|webm|pdf)$/i;

const DEFAULT_THEME = "#0A111F";
const DEFAULT_BACKGROUND = "#F2EDE4";

/**
 * Paths every app host serves as themselves. Auth stays here so a sign-in
 * started on a subdomain can finish on that same host.
 *
 * @param {string} pathname
 */
export function isHostPassthrough(pathname) {
  const path = pathname || "/";
  if (path.startsWith("/_next")) return true;
  if (path === "/api" || path.startsWith("/api/")) return true;
  if (path === "/brand" || path.startsWith("/brand/")) return true;
  if (path === "/manifest.webmanifest" || path === "/manifest.json") return true;
  if (path === "/sw.js" || path.startsWith("/swe-worker")) return true;
  if (path === "/favicon.ico") return true;
  if (path === "/auth" || path.startsWith("/auth/")) return true;
  if (path === "/signin" || path.startsWith("/signin/")) return true;
  if (path === "/welcome" || path.startsWith("/welcome/")) return true;
  if (path === "/offline") return true;
  return STATIC_FILE.test(path);
}

/**
 * @param {string|null|undefined} host
 * @returns {(typeof HOST_MAP)[number]|null}
 */
export function appForHost(host) {
  const name = hostnameOf(host);
  if (!name || name === "localhost") return null;
  if (name === "thereflectivefootball.com" || name === "www.thereflectivefootball.com") return null;
  return (
    HOST_MAP.find(
      (app) => name === `${app.slug}.thereflectivefootball.com` || name === `${app.slug}.localhost`,
    ) || null
  );
}

/**
 * The site path this host should serve. Paths already inside the app are left alone.
 *
 * @param {string|null|undefined} host
 * @param {string} pathname
 */
export function hostAction(host, pathname) {
  const app = appForHost(host);
  const path = pathname || "/";
  if (!app || isHostPassthrough(path)) return { type: "pass" };
  if (path === app.target || path.startsWith(`${app.target}/`)) return { type: "pass" };
  return { type: "rewrite", to: path === "/" ? app.target : `${app.target}${path}` };
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
export function hubUrl(path, host) {
  if (!path || path.startsWith("mailto:") || path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const p = path.startsWith("/") ? path : `/${path}`;
  const app = appForHost(host);
  if (!app) return p;
  if (p === app.target || p.startsWith(`${app.target}/`)) return p;
  return `${HUB_ORIGIN}${p}`;
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
  const app = appForHost(host);
  const slug = app?.slug;
  const icon = (size, maskable) => {
    const file = slug
      ? `/brand/apps/${slug}${maskable ? "-maskable" : ""}-${size}.png`
      : "";
    if (file && hasIcon(file)) return file;
    return maskable ? `/brand/trf-maskable-${size}.png` : `/brand/trf-icon-${size}.png`;
  };
  return {
    name: app?.name || "The Reflective Football",
    short_name: app?.shortName || "TRF",
    start_url: "/",
    scope: "/",
    display: "standalone",
    theme_color: app?.themeColor || DEFAULT_THEME,
    background_color: app?.backgroundColor || DEFAULT_BACKGROUND,
    icons: [192, 512].flatMap((size) => [
      { src: icon(size, false), sizes: `${size}x${size}`, type: "image/png", purpose: "any" },
      { src: icon(size, true), sizes: `${size}x${size}`, type: "image/png", purpose: "maskable" },
    ]),
  };
}
