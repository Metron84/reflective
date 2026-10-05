import { cache } from "react";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { accessTokenFromCookies } from "@/lib/auth/cookie-token";
import { cookies, headers } from "next/headers";
import { withAuthCookieDomain } from "@/lib/ultima/host";

export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const cookieStore = await cookies();
  const host = (await headers()).get("host") ?? "";

  return createServerClient(url, key, {
    cookieOptions: withAuthCookieDomain({}, host),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, withAuthCookieDomain(options, host));
          });
        } catch {
          // Called from a Server Component; middleware keeps sessions fresh.
        }
      },
    },
  });
}

/**
 * One read-only client per request for renders (layout, Header, pages,
 * requireSeat). It carries the access token from the request cookie and has
 * no way to refresh it: middleware refreshes on real navigations, and a
 * render that sees an expired token reports it instead of calling /token.
 * Use createClient() only where cookies can be written (route handlers).
 */
export const getRenderSession = cache(async function getRenderSession() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const cookieStore = await cookies();
  const token = accessTokenFromCookies(cookieStore.getAll(), url);
  const client = createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  });
  return { client, token };
});

export async function getRenderClient() {
  return (await getRenderSession())?.client ?? null;
}
