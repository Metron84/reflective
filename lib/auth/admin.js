import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";

export function profileIsAdmin(profile) {
  return Boolean(profile?.is_admin);
}

/** Server pages: redirect non-admins home. */
export async function requireAdminPage() {
  const auth = await getAuthContext();
  if (!auth.isSignedIn || !profileIsAdmin(auth.profile)) {
    redirect("/");
  }
  return auth;
}

/** API routes: return auth or a NextResponse error body helper. */
export async function requireAdminApi() {
  const auth = await getAuthContext();
  if (!auth.isSignedIn) {
    return { ok: false, status: 401, message: "Sign in required." };
  }
  if (!profileIsAdmin(auth.profile)) {
    return { ok: false, status: 403, message: "Admin only." };
  }
  return { ok: true, ...auth };
}
