import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { appendExpiredCookies, authCookieNamesIn } from "@/lib/auth/stale-cookies";

export async function POST(request) {
  const host = request.headers.get("host") ?? "";
  const names = authCookieNamesIn(request.headers.get("cookie") ?? "");

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.redirect(new URL("/signin", request.url));
  }
  try {
    await supabase.auth.signOut();
  } catch {
    // The cookies below are what sign the browser out.
  }
  const response = NextResponse.redirect(new URL("/", request.url));
  // Expire host-only and shared-domain copies, so no stale one survives.
  return appendExpiredCookies(response, names, host, { scope: "both" });
}
