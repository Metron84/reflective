const STATIC_PREFIXES = [
  "/_next/",
  "/brand",
  "/deliverables",
  "/swe-worker",
  "/sw.js",
  "/manifest.webmanifest",
  "/manifest.json",
  "/ultima/manifest.webmanifest",
];

const STATIC_FILE = /\.(?:svg|png|jpe?g|gif|webp|avif|ico|css|m?js|map|json|txt|xml|woff2?|ttf|otf|mp4|webm|pdf)$/i;

/**
 * Whether middleware should read and refresh the Supabase session.
 *
 * Refresh runs for real navigations only: document loads, client-side RSC
 * navigations, and API calls. Prefetches, the service worker, manifests,
 * _next/data and static files never refresh, so a burst of parallel
 * requests cannot turn one stale token into hundreds of /token calls.
 */
export function shouldRefreshSession(pathname, headers) {
  const get = (name) => headers.get(name) ?? "";

  if (get("next-router-prefetch")) return false;
  if (/prefetch/i.test(get("purpose")) || /prefetch/i.test(get("sec-purpose"))) {
    return false;
  }
  if (STATIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) {
    return false;
  }
  if (STATIC_FILE.test(pathname)) return false;

  if (pathname === "/api" || pathname.startsWith("/api/")) return true;
  if (get("rsc") === "1") return true;
  if (get("sec-fetch-dest") === "document") return true;
  if (get("accept").includes("text/html")) return true;
  return false;
}
