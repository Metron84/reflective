import { hostnameOf } from "@/lib/ultima/host";

/** Where a request goes when it leaves an app. The bare domain, not www. */
export const APEX_ORIGIN = "https://thereflectivefootball.com";

const CREAM = "#F2EDE4";
const NAVY = "#0A111F";
const ULTIMA_CHARCOAL = "#12151C";

/**
 * Subdomain label to the section it serves, plus the home-screen identity.
 * Only routes that exist in `app/` are listed.
 */
export const SUBDOMAINS = {
  play: {
    path: "/play",
    name: "Are You Really a Fan?",
    shortName: "Real Fan?",
    themeColor: NAVY,
    backgroundColor: CREAM,
    description: "Spin the wheel, answer the clue, and see this week's leaderboard.",
  },
  ultima: {
    path: "/ultima",
    name: "Ultima",
    shortName: "Ultima",
    themeColor: ULTIMA_CHARCOAL,
    backgroundColor: ULTIMA_CHARCOAL,
    description:
      "Draft Europe's top five. Thirty players. Fifteen score each week. Invite only. The Reflective Football fantasy league.",
  },
  codemaster: {
    path: "/codemaster",
    name: "Codemaster",
    shortName: "Codemaster",
    themeColor: NAVY,
    backgroundColor: CREAM,
    description:
      "Drop the letters back into place and decode two decades of football. Solve every grid to become the Codemaster.",
  },
  guesser: {
    path: "/guesser",
    name: "The Guesser",
    shortName: "Guesser",
    themeColor: NAVY,
    backgroundColor: CREAM,
    description: "Five footballers a day. A new clue lands each time the points drop. Tap to answer.",
  },
  crest: {
    path: "/crest",
    name: "The Crest",
    shortName: "The Crest",
    themeColor: NAVY,
    backgroundColor: CREAM,
    description: "Matched on heart, mind and soul",
  },
  concierge: {
    path: "/concierge",
    name: "TRF Concierge",
    shortName: "Concierge",
    themeColor: NAVY,
    backgroundColor: CREAM,
    description: "Ask about venues, atmospheres, and the best fan moments we've filmed.",
  },
  events: {
    path: "/events",
    name: "TRF Events",
    shortName: "TRF Events",
    themeColor: NAVY,
    backgroundColor: CREAM,
    description:
      "For All The Fans nights, and the Concierge for finding where your club watches in Dubai.",
  },
  compete: {
    path: "/competitions",
    name: "TRF Competitions",
    shortName: "TRF Compete",
    themeColor: NAVY,
    backgroundColor: CREAM,
    description:
      "The Reflectives, King of the Burgers, and The Treble. Competitions run by and for football fans.",
  },
  observatory: {
    path: "/observatory",
    name: "TRF Observatory",
    shortName: "Observatory",
    themeColor: NAVY,
    backgroundColor: CREAM,
    description:
      "Where TRF studies football fans. Open studies you can take part in, and the reports that come out of them.",
  },
  watchwith: {
    path: "/watch-with",
    name: "Who Would You Rather Watch With?",
    shortName: "Watch With",
    themeColor: NAVY,
    backgroundColor: CREAM,
    description: "Dream matchday. Any era. You choose who sits next to you.",
  },
};

/** @param {string} key */
export function subdomainPath(key) {
  return SUBDOMAINS[key]?.path || "";
}

const FILE = /\.[a-z0-9]+$/i;

/**
 * Pages that belong to the hub, not to the app in the subdomain.
 * My Programme is /account. /my-programme is the name used in the brief.
 */
const HUB_PAGES = [
  "/games",
  "/films",
  "/reflections",
  "/account",
  "/my-programme",
  "/about",
  "/privacy",
  "/terms",
  "/archive",
  "/stand",
  "/training",
  "/laliga",
  "/treble",
  "/king-of-the-burgers",
  "/for-all-the-fans",
  "/clockend",
  "/admin",
  "/compete",
];

const LEAVE_PREFIXES = [...new Set([...HUB_PAGES, ...Object.values(SUBDOMAINS).map((app) => app.path)])];

/**
 * Paths an app host serves as themselves.
 * Sign-in, welcome, and offline stay here because the auth gate redirects to them on this host.
 *
 * @param {string} pathname
 */
export function isSubdomainPassthrough(pathname) {
  const path = pathname || "/";
  if (path.startsWith("/_next")) return true;
  if (path === "/api" || path.startsWith("/api/")) return true;
  if (path === "/auth" || path.startsWith("/auth/")) return true;
  if (path === "/sw.js" || path.startsWith("/swe-worker")) return true;
  if (path === "/manifest.webmanifest" || path === "/manifest.json") return true;
  if (path === "/favicon.ico" || path.startsWith("/favicon")) return true;
  if (path === "/icons" || path.startsWith("/icons/")) return true;
  if (path === "/promo" || path.startsWith("/promo/")) return true;
  if (path === "/signin" || path.startsWith("/signin/")) return true;
  if (path === "/welcome" || path.startsWith("/welcome/")) return true;
  if (path === "/offline") return true;
  return FILE.test(path);
}

/**
 * @param {string|null|undefined} host
 * @returns {{ slug: string, target: string, name: string, shortName: string, themeColor: string, backgroundColor: string, description: string }|null}
 */
export function appForSubdomain(host) {
  const name = hostnameOf(host);
  if (!name || name === "localhost") return null;
  if (name === "thereflectivefootball.com" || name === "www.thereflectivefootball.com") return null;
  const slug = Object.keys(SUBDOMAINS).find(
    (key) => name === `${key}.thereflectivefootball.com` || name === `${key}.localhost`,
  );
  if (!slug) return null;
  const app = SUBDOMAINS[slug];
  return { slug, target: app.path, ...app };
}

/**
 * @param {string} path
 * @param {string} target
 */
function leavesSection(path, target) {
  if (path === target || path.startsWith(`${target}/`)) return false;
  return LEAVE_PREFIXES.some(
    (prefix) => prefix !== target && (path === prefix || path.startsWith(`${prefix}/`)),
  );
}

/**
 * What this host does with a path.
 * pass: serve it. rewrite: serve `to` under the same URL. redirect: 307 to the apex.
 *
 * @param {string|null|undefined} host
 * @param {string} pathname
 * @returns {{ type: "pass" }|{ type: "rewrite", to: string }|{ type: "redirect", to: string }}
 */
export function subdomainAction(host, pathname) {
  const app = appForSubdomain(host);
  const path = pathname || "/";
  if (!app || isSubdomainPassthrough(path)) return { type: "pass" };
  if (path === app.target || path.startsWith(`${app.target}/`)) return { type: "pass" };
  if (leavesSection(path, app.target)) return { type: "redirect", to: `${APEX_ORIGIN}${path}` };
  return { type: "rewrite", to: path === "/" ? app.target : `${app.target}${path}` };
}

const TRF_ICON = {
  "icon-192.png": "/brand/trf-icon-192.png",
  "icon-512.png": "/brand/trf-icon-512.png",
  "maskable-512.png": "/brand/trf-maskable-512.png",
  "apple-touch-icon.png": "/brand/trf-icon-180.png",
};

/**
 * Preferred icon, or the current TRF icon when that file is not in public/.
 *
 * @param {string} key
 * @param {keyof typeof TRF_ICON} file
 * @param {(src: string) => boolean} [hasIcon]
 */
export function appIcon(key, file, hasIcon = () => false) {
  const preferred = `/icons/${key}/${file}`;
  if (hasIcon(preferred)) return preferred;
  return TRF_ICON[file];
}

/**
 * Web app manifest for this host. The bare domain and www stay the TRF manifest.
 *
 * @param {string|null|undefined} host
 * @param {(src: string) => boolean} [hasIcon]
 */
export function manifestForSubdomain(host, hasIcon = () => false) {
  const app = appForSubdomain(host);
  if (!app) {
    const icon = (size, maskable) =>
      maskable ? `/brand/trf-maskable-${size}.png` : `/brand/trf-icon-${size}.png`;
    return {
      name: "The Reflective Football",
      short_name: "TRF",
      start_url: "/",
      scope: "/",
      display: "standalone",
      theme_color: "#0A111F",
      background_color: "#F2EDE4",
      icons: [192, 512].flatMap((size) => [
        { src: icon(size, false), sizes: `${size}x${size}`, type: "image/png", purpose: "any" },
        { src: icon(size, true), sizes: `${size}x${size}`, type: "image/png", purpose: "maskable" },
      ]),
    };
  }
  return {
    id: `/${app.slug}`,
    name: app.name,
    short_name: app.shortName,
    description: app.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    theme_color: app.themeColor,
    background_color: app.backgroundColor,
    icons: [
      { src: appIcon(app.slug, "icon-192.png", hasIcon), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: appIcon(app.slug, "icon-512.png", hasIcon), sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: appIcon(app.slug, "maskable-512.png", hasIcon),
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
