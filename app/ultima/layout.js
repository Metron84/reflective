import { profileIsAdmin } from "@/lib/auth/admin";
import { getAuthContext } from "@/lib/auth/session";
import UltimaShell from "@/components/ultima/UltimaShell";
import { getManagerForUser, isCommissionerUser } from "@/lib/ultima/server/db";
import { safeResolve } from "@/lib/ultima/server/safe";

export default async function UltimaLayout({ children }) {
  const auth = await safeResolve(getAuthContext(), {
    user: null,
    profile: null,
    isSignedIn: false,
  });
  const manager =
    auth.isSignedIn && auth.user
      ? await getManagerForUser(auth.user.id)
      : null;

  return (
    <UltimaShell
      manager={Boolean(manager)}
      isCommissioner={
        Boolean(auth.isSignedIn && auth.user) &&
        (profileIsAdmin(auth.profile) || isCommissionerUser(auth.user.id))
      }
    >
      {children}
    </UltimaShell>
  );
}
