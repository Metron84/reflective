import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { getManagerForUser } from "@/lib/ultima/server/db";

/**
 * Require signed-in human manager for Ultima manager routes.
 * @param {string} returnPath e.g. "/ultima/squad"
 */
export async function requireUltimaManager(returnPath) {
  const auth = await getAuthContext();
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
  return { auth, manager };
}
