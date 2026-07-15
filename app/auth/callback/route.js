import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase";
import { defaultNameFromEmail } from "@/lib/auth/config";

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
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/signin?error=auth`);
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.redirect(`${origin}/signin?error=config`);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/signin?error=auth`);
  }

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
      return NextResponse.redirect(`${origin}/welcome?next=${encodeURIComponent(next)}`);
    }
  }

  return NextResponse.redirect(`${origin}${next.startsWith("/") ? next : `/${next}`}`);
}
