import {
  CacheFirst,
  ExpirationPlugin,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
} from "serwist";
import {
  ARCHIVE_CACHE_REVISION,
  ARCHIVE_JSON_URLS,
} from "./sw-archive-meta";

function isArchivePagePath(pathname) {
  if (pathname === "/archive") return true;
  if (!pathname.startsWith("/archive/")) return false;
  // JSON payloads under /archive/data/ use their own strategy.
  if (pathname.startsWith("/archive/data/")) return false;
  return true;
}

function isArchiveJsonPath(pathname) {
  return pathname.startsWith("/archive/data/");
}

const archivePagesCache = `archive-pages-${ARCHIVE_CACHE_REVISION}`;
const archiveJsonCache = `archive-json-${ARCHIVE_CACHE_REVISION}`;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Cross-origin (Supabase, YouTube, etc.): never cache.
    {
      matcher: ({ sameOrigin }) => !sameOrigin,
      handler: new NetworkOnly(),
    },
    // APIs, auth, admin: never cache.
    {
      matcher: ({ sameOrigin, url: { pathname } }) =>
        sameOrigin &&
        (pathname.startsWith("/api/") ||
          pathname.startsWith("/auth/") ||
          pathname.startsWith("/admin/")),
      handler: new NetworkOnly(),
    },
    // Beautiful Archive pages + RSC: cache-first with background revalidate.
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
    // Navigations + RSC payloads (non-archive): NetworkOnly so stale pages are impossible.
    {
      matcher: ({ request, sameOrigin, url: { pathname } }) =>
        sameOrigin &&
        !pathname.startsWith("/api/") &&
        !isArchivePagePath(pathname) &&
        (request.mode === "navigate" ||
          request.destination === "document" ||
          request.headers.get("RSC") === "1"),
      handler: new NetworkOnly(),
    },
    // Hashed Next build assets.
    {
      matcher: ({ sameOrigin, url: { pathname } }) =>
        sameOrigin && pathname.startsWith("/_next/static/"),
      handler: new CacheFirst({
        cacheName: "next-static",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 128,
            maxAgeSeconds: 365 * 24 * 60 * 60,
            maxAgeFrom: "last-used",
          }),
        ],
      }),
    },
    // Brand icons / static crest assets used by the shell + offline page.
    {
      matcher: ({ sameOrigin, url: { pathname } }) =>
        sameOrigin && pathname.startsWith("/brand/"),
      handler: new CacheFirst({
        cacheName: "brand-assets",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 32,
            maxAgeSeconds: 30 * 24 * 60 * 60,
            maxAgeFrom: "last-used",
          }),
        ],
      }),
    },
    // Same-origin catch-all: network only (freshness over offline breadth).
    {
      matcher: ({ sameOrigin }) => sameOrigin,
      handler: new NetworkOnly(),
    },
  ],
  fallbacks: {
    entries: [
      {
        // Unvisited archive entry while offline → cached index.
        // Offline notice is shown client-side on /archive when offline.
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
