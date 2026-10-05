import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { shouldRefreshSession } from "@/lib/auth/refresh-policy";
import {
  isUltimaAppHost,
  isUltimaAppLeaf,
  isUltimaPassthrough,
  withAuthCookieDomain,
} from "@/lib/ultima/host";

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

export async function middleware(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const host = request.headers.get("host") ?? "";
  if (!url || !key) {
    if (isUltimaAppHost(host)) {
      return ultimaHostResponse(request) ?? nextWithPath(request);
    }
    return nextWithPath(request);
  }

  // Prefetches, the service worker, manifests and static files never touch
  // the Auth server. See lib/auth/refresh-policy.js.
  if (!shouldRefreshSession(request.nextUrl.pathname, request.headers)) {
    if (isUltimaAppHost(host)) {
      return ultimaHostResponse(request) ?? nextWithPath(request);
    }
    return nextWithPath(request);
  }

  const cookieBag = [];
  const originalCookies = request.cookies.getAll();
  // auth-js deletes the session when a refresh fails for any reason that is
  // not a network error, including a 429. Watch the /token call so a rate
  // limit or outage leaves the cookies alone instead of signing the user out.
  let refreshFailed = false;
  const watchedFetch = async (input, init) => {
    const isRefresh = String(input?.url ?? input).includes("/auth/v1/token");
    try {
      const res = await fetch(input, init);
      if (isRefresh && (res.status === 429 || res.status >= 500)) refreshFailed = true;
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
  // token is stale. This is the only place a request refreshes.
  const { data: claimsData } = await supabase.auth.getClaims();
  if (refreshFailed) {
    // Put the request cookies back exactly as they arrived. The render sees
    // the stale token and reports `unavailable`; the browser keeps its session.
    for (const { name } of request.cookies.getAll()) request.cookies.delete(name);
    for (const { name, value } of originalCookies) request.cookies.set(name, value);
    cookieBag.length = 0;
  }
  const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;
  const pathname = request.nextUrl.pathname;

  let response = nextWithPath(request);

  if (
    user &&
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
      return applyAuthCookies(response, cookieBag, host);
    }
  }

  if (isUltimaAppHost(host)) {
    response = ultimaHostResponse(request) ?? response;
  }

  return applyAuthCookies(response, cookieBag, host);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
