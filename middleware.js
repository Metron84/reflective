import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
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

function ultimaHostResponse(request) {
  const pathname = request.nextUrl.pathname;
  const url = request.nextUrl.clone();

  if (pathname === "/manifest.webmanifest" || pathname === "/manifest.json") {
    url.pathname = "/ultima/manifest.webmanifest";
    return NextResponse.rewrite(url);
  }

  if (isUltimaPassthrough(pathname)) {
    return null;
  }

  if (pathname === "/" || pathname === "") {
    url.pathname = "/ultima";
    return NextResponse.rewrite(url);
  }

  if (isUltimaAppLeaf(pathname)) {
    url.pathname = `/ultima${pathname}`;
    return NextResponse.rewrite(url);
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
      return ultimaHostResponse(request) ?? NextResponse.next({ request });
    }
    return NextResponse.next();
  }

  const cookieBag = [];
  const supabase = createServerClient(url, key, {
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  let response = NextResponse.next({ request });

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
