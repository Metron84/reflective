import {
  ExpirationPlugin,
  NetworkFirst,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
} from "serwist";
import {
  ARCHIVE_CACHE_REVISION,
  ARCHIVE_JSON_URLS,
} from "./sw-archive-meta";

/** Bump when runtime cache strategy changes so clients drop old caches. */
const CACHE_VERSION = "net-v1";

const NEVER_CACHE_API_PATHS = new Set([
  "/api/laliga",
  "/api/codemaster/progress",
  "/api/codemaster/solve",
]);

function isArchivePagePath(pathname) {
  if (pathname === "/archive") return true;
  if (!pathname.startsWith("/archive/")) return false;
  if (pathname.startsWith("/archive/data/")) return false;
  return true;
}

function isArchiveJsonPath(pathname) {
  return pathname.startsWith("/archive/data/");
}

function isUltimaPath(pathname) {
  return pathname === "/ultima" || pathname.startsWith("/ultima/");
}

function isDocumentOrRsc(request) {
  return (
    request.mode === "navigate" ||
    request.destination === "document" ||
    request.headers.get("RSC") === "1"
  );
}

function isNeverCacheApi(pathname) {
  const normalized =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  return NEVER_CACHE_API_PATHS.has(normalized);
}

function isStaticAsset({ request, pathname }) {
  const dest = request.destination;
  if (
    dest === "style" ||
    dest === "script" ||
    dest === "worker" ||
    dest === "font" ||
    dest === "image"
  ) {
    return true;
  }
  if (pathname.startsWith("/_next/static/")) return true;
  if (pathname.startsWith("/brand/")) return true;
  return /\.(?:js|css|woff2?|ttf|otf|eot|png|jpe?g|gif|webp|avif|svg|ico)$/i.test(
    pathname,
  );
}

const pagesCache = `pages-${CACHE_VERSION}`;
const staticCache = `static-${CACHE_VERSION}`;
const apiCache = `api-${CACHE_VERSION}`;
const archivePagesCache = `archive-pages-${CACHE_VERSION}-${ARCHIVE_CACHE_REVISION}`;
const archiveJsonCache = `archive-json-${CACHE_VERSION}-${ARCHIVE_CACHE_REVISION}`;

/** High-traffic doors only — warmed into pages cache on activate. */
const WARM_PAGE_ROUTES = ["/films", "/games", "/reflections", "/training"];

const CURRENT_CACHE_NAMES = new Set([
  pagesCache,
  staticCache,
  apiCache,
  archivePagesCache,
  archiveJsonCache,
]);

/** Prefetch HTML for the three warm routes into the pages cache. Fail quietly offline. */
async function warmHighTrafficPages() {
  try {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return;
    }
    const cache = await caches.open(pagesCache);
    await Promise.all(
      WARM_PAGE_ROUTES.map(async (pathname) => {
        try {
          const url = new URL(pathname, self.location.origin).href;
          const response = await fetch(url, {
            credentials: "same-origin",
            redirect: "follow",
          });
          if (!response.ok) return;
          await cache.put(url, response.clone());
        } catch {
          // Offline or transient failure — leave cache as-is.
        }
      }),
    );
  } catch {
    // Ignore warm-up failures entirely.
  }
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  cacheId: CACHE_VERSION,
  precacheOptions: {
    cleanupOutdatedCaches: true,
  },
  runtimeCaching: [
    // Cross-origin (Supabase, YouTube, etc.): never cache.
    {
      matcher: ({ sameOrigin }) => !sameOrigin,
      handler: new NetworkOnly(),
    },
    // Live mutations / progress: never cache.
    {
      matcher: ({ sameOrigin, url: { pathname } }) =>
        sameOrigin && isNeverCacheApi(pathname),
      handler: new NetworkOnly(),
    },
    // Other same-origin APIs: network-first so live data wins.
    {
      matcher: ({ request, sameOrigin, url: { pathname } }) =>
        sameOrigin &&
        request.method === "GET" &&
        pathname.startsWith("/api/"),
      handler: new NetworkFirst({
        cacheName: apiCache,
        networkTimeoutSeconds: 8,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 48,
            maxAgeSeconds: 5 * 60,
            maxAgeFrom: "last-used",
          }),
        ],
      }),
    },
    // Auth + admin: never cache.
    {
      matcher: ({ sameOrigin, url: { pathname } }) =>
        sameOrigin &&
        (pathname.startsWith("/auth/") || pathname.startsWith("/admin/")),
      handler: new NetworkOnly(),
    },
    // Ultima is live. Never serve a stale hub, draft, or squad.
    {
      matcher: ({ request, sameOrigin, url: { pathname } }) =>
        sameOrigin && isUltimaPath(pathname) && isDocumentOrRsc(request),
      handler: new NetworkOnly(),
    },
    // Beautiful Archive pages + RSC payloads.
    {
      matcher: ({ request, sameOrigin, url: { pathname } }) =>
        sameOrigin &&
        isArchivePagePath(pathname) &&
        (request.mode === "navigate" ||
          request.destination === "document" ||
          request.headers.get("RSC") === "1"),
      handler: new StaleWhileRevalidate({
        cacheName: archivePagesCache,
      }),
    },
    // Published archive JSON payloads (never holding.json).
    {
      matcher: ({ sameOrigin, url: { pathname } }) =>
        sameOrigin && isArchiveJsonPath(pathname),
      handler: new StaleWhileRevalidate({
        cacheName: archiveJsonCache,
        plugins: [
          new ExpirationPlugin({
            maxEntries: Math.max(8, ARCHIVE_JSON_URLS.length + 4),
            maxAgeSeconds: 30 * 24 * 60 * 60,
            maxAgeFrom: "last-used",
          }),
        ],
      }),
    },
    // HTML + RSC: network first so a Vercel deploy shows on the next open.
    // Cache is only the offline fallback. Timeout keeps door taps from hanging.
    {
      matcher: ({ request, sameOrigin, url: { pathname } }) =>
        sameOrigin &&
        !pathname.startsWith("/api/") &&
        !isArchivePagePath(pathname) &&
        !isUltimaPath(pathname) &&
        isDocumentOrRsc(request),
      handler: new NetworkFirst({
        cacheName: pagesCache,
        networkTimeoutSeconds: 4,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 48,
            maxAgeSeconds: 24 * 60 * 60,
            maxAgeFrom: "last-used",
          }),
        ],
      }),
    },
    // JS, CSS, fonts, images (including hashed Next assets + brand).
    {
      matcher: ({ request, sameOrigin, url: { pathname } }) =>
        sameOrigin && isStaticAsset({ request, pathname }),
      handler: new StaleWhileRevalidate({
        cacheName: staticCache,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 192,
            maxAgeSeconds: 30 * 24 * 60 * 60,
            maxAgeFrom: "last-used",
          }),
        ],
      }),
    },
    // Same-origin catch-all: network only (do not cache video/audio/etc.).
    {
      matcher: ({ sameOrigin }) => sameOrigin,
      handler: new NetworkOnly(),
    },
  ],
  fallbacks: {
    entries: [
      {
        // Unvisited archive entry while offline → cached index.
        url: "/archive",
        matcher({ request, url }) {
          return (
            request.destination === "document" &&
            url.pathname.startsWith("/archive/") &&
            !url.pathname.startsWith("/archive/data/")
          );
        },
      },
      {
        url: "/offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();

// Drop runtime caches from prior strategy versions (precache cleanup is above).
// Then warm the three highest-traffic doors into pages-swr-v1.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map(async (key) => {
          // Keep Serwist precache buckets and the current runtime version set.
          if (key.includes("precache")) return;
          if (CURRENT_CACHE_NAMES.has(key)) return;
          // Legacy names from before CACHE_VERSION (archive-pages-*, next-static, …).
          if (
            key.startsWith("archive-pages-") ||
            key.startsWith("archive-json-") ||
            key === "next-static" ||
            key === "brand-assets" ||
            (key.startsWith("pages-") && key !== pagesCache) ||
            (key.startsWith("static-") && key !== staticCache) ||
            (key.startsWith("api-") && key !== apiCache)
          ) {
            await caches.delete(key);
          }
        }),
      );
      await warmHighTrafficPages();
    })(),
  );
});
