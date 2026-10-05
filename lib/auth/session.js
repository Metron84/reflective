import { cache } from "react";
import { getRenderClient, getRenderSession } from "@/lib/supabase/server";

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
 * Verify the access token from the request cookie locally (getClaims with
 * the token). This never calls /token: middleware refreshes on real
 * navigations, so an expired token here means the refresh did not happen or
 * failed. `error` is set whenever auth could not be checked (expired token,
 * rate limit, network); a plain signed-out visitor has error null. Callers
 * must treat an error as unavailable, never as signed out.
 */
export const getSessionResult = cache(async function getSessionResult() {
  const session = await getRenderSession();
  if (!session?.token) return { user: null, error: null };
  try {
    const { data, error } = await session.client.auth.getClaims(session.token);
    if (data?.claims?.sub) return { user: userFromClaims(data.claims), error: null };
    return { user: null, error: error ?? new Error("session_unreadable") };
  } catch (error) {
    return { user: null, error };
  }
});

export async function getSessionUser() {
  const { user } = await getSessionResult();
  return user;
}

export async function getProfile(userId) {
  const supabase = await getRenderClient();
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

/**
 * Ask the Auth server to confirm the user. Use before writes only; reads
 * and page gates stay on local verification. Sends the cookie token as is:
 * no refresh and no cookie writes, so a rate limit can never sign anyone out
 * or trigger a second /token call in the same request. `error` is set when
 * the check could not be made (rate limit, network, expired token); a
 * rejected session has user null and error null.
 */
export async function getVerifiedUser() {
  const session = await getRenderSession();
  if (!session?.token) return { user: null, error: null };
  try {
    const { data, error } = await session.client.auth.getUser(session.token);
    if (data?.user) return { user: data.user, error: null };
    const status = error?.status;
    const rejected =
      error?.name === "AuthSessionMissingError" ||
      (typeof status === "number" && status >= 400 && status < 500 && status !== 429);
    return { user: null, error: rejected ? null : error };
  } catch (error) {
    return { user: null, error };
  }
}
