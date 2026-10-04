import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

function userFromClaims(claims) {
  return {
    id: claims.sub,
    email: claims.email ?? null,
    phone: claims.phone ?? null,
    role: claims.role ?? null,
    user_metadata: claims.user_metadata ?? {},
    app_metadata: claims.app_metadata ?? {},
  };
}

/**
 * Verify the session JWT locally (getClaims) instead of calling the Auth
 * server on every request, which tripped over_request_rate_limit (429).
 * `error` is set only when auth could not be checked (for example a rate
 * limit or refresh failure); a plain signed-out visitor has error null.
 */
export const getSessionResult = cache(async function getSessionResult() {
  const supabase = await createClient();
  if (!supabase) return { user: null, error: null };
  try {
    const { data, error } = await supabase.auth.getClaims();
    if (data?.claims?.sub) return { user: userFromClaims(data.claims), error: null };
    return { user: null, error: error ?? null };
  } catch (error) {
    return { user: null, error };
  }
});

export async function getSessionUser() {
  const { user } = await getSessionResult();
  return user;
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

export const getAuthContext = cache(async function getAuthContext() {
  const { user, error } = await getSessionResult();
  if (!user) {
    return { user: null, profile: null, isSignedIn: false, authError: Boolean(error) };
  }
  const profile = await getProfile(user.id);
  return { user, profile, isSignedIn: true, authError: false };
});
