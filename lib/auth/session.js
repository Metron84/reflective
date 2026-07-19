import { createClient } from "@/lib/supabase/server";

export async function getSessionUser() {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
}

export async function getProfile(userId) {
  const supabase = await createClient();
  if (!supabase || !userId) return null;
  const { data } = await supabase
    .from("profiles")
    .select(
      "id, preferred_name, clubs, member_number, marketing_consent, welcome_completed, created_at, is_admin"
    )
    .eq("id", userId)
    .maybeSingle();
  return data ?? null;
}

export async function getAuthContext() {
  const user = await getSessionUser();
  if (!user) {
    return { user: null, profile: null, isSignedIn: false };
  }
  const profile = await getProfile(user.id);
  return { user, profile, isSignedIn: true };
}
