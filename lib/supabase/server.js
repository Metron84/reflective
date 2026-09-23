import { createServerClient } from "@supabase/ssr";
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
