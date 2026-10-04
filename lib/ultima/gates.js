import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { getManagerForUser } from "@/lib/ultima/server/db";

/**
 * Require signed-in human manager for Ultima manager routes.
 * @param {string} returnPath e.g. "/ultima/squad"
 */
export async function requireUltimaManager(returnPath, { tolerateAuthError = false } = {}) {
  const auth = await getAuthContext();
  if (!auth.isSignedIn && auth.authError) {
    // Auth could not be checked (rate limit, refresh failure). Never treat
    // that as signed out.
    if (tolerateAuthError) return { auth, manager: null, authError: true };
    throw new Error("ultima_auth_unavailable");
  }
  if (!auth.isSignedIn) {
    redirect(`/signin?next=${encodeURIComponent(returnPath)}`);
  }
  if (!auth.profile?.welcome_completed) {
    redirect(`/welcome?next=${encodeURIComponent(returnPath)}`);
  }
  const manager = await getManagerForUser(auth.user.id);
  if (!manager) {
    redirect("/ultima");
  }
  return { auth, manager, authError: false };
}
