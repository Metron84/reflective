import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getServiceClient } from "@/lib/supabase";
import { defaultNameFromEmail } from "@/lib/auth/config";
import { safeNextPath } from "@/lib/auth/safe-next";
import {
  appendExpiredCookies,
  authCookieNamesIn,
  isAuthCookieName,
} from "@/lib/auth/stale-cookies";
import { withAuthCookieDomain } from "@/lib/ultima/host";

async function ensureProfile(user) {
  const service = getServiceClient();
  if (!service || !user?.id) return;
  const { data: existing } = await service
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (existing) return;
  await service.from("profiles").insert({
    id: user.id,
    preferred_name: defaultNameFromEmail(user.email),
    welcome_completed: false,
  });
}

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const host = request.headers.get("host") ?? "";
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));
  const fail = (reason) => NextResponse.redirect(`${origin}/signin?error=${reason}`);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return fail("config");
  if (!code) return fail("callback");

  // Any session cookie that arrives with this request is from a sign-in that
  // is being replaced, and may be dead. Hide it from the client so the
  // exchange never reads or refreshes it, and expire every copy afterwards.
  const rawCookie = request.headers.get("cookie") ?? "";
  const staleNames = authCookieNamesIn(rawCookie);
  const cookieBag = [];
  const supabase = createServerClient(url, key, {
    cookieOptions: withAuthCookieDomain({}, host),
    cookies: {
      getAll() {
        return request.cookies.getAll().filter(({ name }) => !isAuthCookieName(name));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieBag.push({ name, value, options: withAuthCookieDomain(options, host) });
        });
      },
    },
  });

  const finish = (response) => {
    cookieBag.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    appendExpiredCookies(response, staleNames, host, { scope: "both" });
    return response;
  };

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return finish(fail("callback"));

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await ensureProfile(user);
    const { data: profile } = await supabase
      .from("profiles")
      .select("welcome_completed")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.welcome_completed) {
      return finish(
        NextResponse.redirect(`${origin}/welcome?next=${encodeURIComponent(next)}`),
      );
    }
  }

  return finish(NextResponse.redirect(`${origin}${next}`));
}
