import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { shouldRefreshSession } from "@/lib/auth/refresh-policy";
import {
  appendExpiredCookies,
  authCookieNamesIn,
  duplicateAuthCookieNames,
} from "@/lib/auth/stale-cookies";
import {
  isUltimaAppHost,
  isUltimaAppLeaf,
  isUltimaPassthrough,
  withAuthCookieDomain,
} from "@/lib/ultima/host";
import { isPlayHost, playHostAction } from "@/lib/play/host";
import { isObservatoryHost, observatoryHostAction } from "@/lib/observatory/host";
import { isWatchWithHost, watchWithHostAction } from "@/lib/watch-with/host";

const PUBLIC_PATHS = [
  "/signin",
  "/auth/callback",
  "/auth/signout",
  "/privacy",
  "/about",
];

function isPublicPath(pathname) {
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return true;
  }
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/brand") ||
    pathname.startsWith("/deliverables") ||
    pathname.startsWith("/api/dev") ||
    pathname === "/sw.js" ||
    pathname.startsWith("/swe-worker") ||
    pathname === "/offline" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/manifest.json" ||
    pathname === "/ultima/manifest.webmanifest"
  ) {
    return true;
  }
  return false;
}

function applyAuthCookies(response, cookiesToSet, host) {
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, withAuthCookieDomain(options, host));
  });
  return response;
}

// Built after the session refresh, so request.cookies already holds the new
// tokens. Every response that reaches a page must forward these headers, or
// the page reads the old, expired token.
function forwardedHeaders(request) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  return requestHeaders;
}

function nextWithPath(request) {
  return NextResponse.next({ request: { headers: forwardedHeaders(request) } });
}

function rewriteWithPath(request, url) {
  return NextResponse.rewrite(url, { request: { headers: forwardedHeaders(request) } });
}

function ultimaHostResponse(request) {
  const pathname = request.nextUrl.pathname;
  const url = request.nextUrl.clone();

  if (pathname === "/manifest.webmanifest" || pathname === "/manifest.json") {
    url.pathname = "/ultima/manifest.webmanifest";
    return rewriteWithPath(request, url);
  }

  if (isUltimaPassthrough(pathname)) {
    return null;
  }

  if (pathname === "/" || pathname === "") {
    url.pathname = "/ultima";
    return rewriteWithPath(request, url);
  }

  if (isUltimaAppLeaf(pathname)) {
    url.pathname = `/ultima${pathname}`;
    return rewriteWithPath(request, url);
  }

  url.pathname = "/";
  url.search = "";
  return NextResponse.redirect(url);
}

function playHostResponse(request) {
  const action = playHostAction(request.nextUrl.pathname);
  if (action.type === "pass") return null;
  const url = request.nextUrl.clone();
  url.pathname = action.to;
  if (action.type === "rewrite") return rewriteWithPath(request, url);
  if (!action.keepSearch) url.search = "";
  return NextResponse.redirect(url);
}

function observatoryHostResponse(request) {
  const action = observatoryHostAction(request.nextUrl.pathname);
  if (action.type === "pass") return null;
  const url = request.nextUrl.clone();
  url.pathname = action.to;
  if (action.type === "rewrite") return rewriteWithPath(request, url);
  if (!action.keepSearch) url.search = "";
  return NextResponse.redirect(url);
}

function watchWithHostResponse(request) {
  const action = watchWithHostAction(request.nextUrl.pathname);
  if (action.type === "pass") return null;
  const url = request.nextUrl.clone();
  url.pathname = action.to;
  if (action.type === "rewrite") return rewriteWithPath(request, url);
  if (!action.keepSearch) url.search = "";
  return NextResponse.redirect(url);
}

/** Subdomain routing: Ultima, play, the observatory and watch-with each own a host. */
function appHostResponse(request, host) {
  if (isUltimaAppHost(host)) return ultimaHostResponse(request);
  if (isPlayHost(host)) return playHostResponse(request);
  if (isObservatoryHost(host)) return observatoryHostResponse(request);
  if (isWatchWithHost(host)) return watchWithHostResponse(request);
  return null;
}

export async function middleware(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const host = request.headers.get("host") ?? "";
  if (!url || !key) {
    return appHostResponse(request, host) ?? nextWithPath(request);
  }

  // Prefetches, the service worker, manifests and static files never touch
  // the Auth server. See lib/auth/refresh-policy.js.
  if (!shouldRefreshSession(request.nextUrl.pathname, request.headers)) {
    return appHostResponse(request, host) ?? nextWithPath(request);
  }

  const cookieBag = [];
  const originalCookies = request.cookies.getAll();
  // auth-js deletes the session when a refresh fails for any reason that is
  // not a network error, including a 429. Watch the /token call so a rate
  // limit or outage leaves the cookies alone instead of signing the user out.
  let refreshFailed = false;
  let refreshRejected = false;
  const rawCookie = request.headers.get("cookie") ?? "";
  const watchedFetch = async (input, init) => {
    const isRefresh = String(input?.url ?? input).includes("/auth/v1/token");
    try {
      const res = await fetch(input, init);
      if (isRefresh && (res.status === 429 || res.status >= 500)) refreshFailed = true;
      if (isRefresh && res.status === 400) refreshRejected = true;
      return res;
    } catch (error) {
      if (isRefresh) refreshFailed = true;
      throw error;
    }
  };
  const supabase = createServerClient(url, key, {
    global: { fetch: watchedFetch },
    cookieOptions: withAuthCookieDomain({}, host),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          cookieBag.push({ name, value, options });
        });
      },
    },
  });

  // Verifies the JWT locally and refreshes the session only when the access
  // token is stale. This is the only place a request refreshes. A throw here
  // (for example a refresh token used twice) must not become an HTML error.
  let claimsData = null;
  try {
    const claims = await supabase.auth.getClaims();
    claimsData = claims?.data ?? null;
  } catch {
    claimsData = null;
  }
  if (refreshFailed) {
    // Put the request cookies back exactly as they arrived. The render sees
    // the stale token and reports `unavailable`; the browser keeps its session.
    for (const { name } of request.cookies.getAll()) request.cookies.delete(name);
    for (const { name, value } of originalCookies) request.cookies.set(name, value);
    cookieBag.length = 0;
  }
  // A stale host-only copy next to the shared-domain cookie shadows it. Two
  // copies of one name: expire the host-only ones. A rejected refresh token
  // (400): the session is dead, expire every copy in both scopes so none is
  // left to shadow the next sign-in.
  const staleHostOnly = refreshRejected ? [] : duplicateAuthCookieNames(rawCookie);
  const deadSession = refreshRejected ? authCookieNamesIn(rawCookie) : [];
  const finish = (res) => {
    applyAuthCookies(res, cookieBag, host);
    appendExpiredCookies(res, staleHostOnly, host, { scope: "host" });
    appendExpiredCookies(res, deadSession, host, { scope: "both" });
    return res;
  };
  const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;
  const pathname = request.nextUrl.pathname;

  let response = nextWithPath(request);

  const playApi = pathname === "/api/play" || pathname.startsWith("/api/play/");
  if (
    user &&
    !playApi &&
    !isPublicPath(pathname) &&
    pathname !== "/welcome" &&
    !pathname.startsWith("/api/auth")
  ) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("welcome_completed")
      .eq("id", user.id)
      .maybeSingle();

    if (profile && !profile.welcome_completed) {
      const welcomeUrl = request.nextUrl.clone();
      welcomeUrl.pathname = "/welcome";
      welcomeUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
      response = NextResponse.redirect(welcomeUrl);
      return finish(response);
    }
  }

  response = appHostResponse(request, host) ?? response;

  return finish(response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
