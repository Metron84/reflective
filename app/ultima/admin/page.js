import { redirect } from "next/navigation";
import UltimaPhaseShell from "@/components/ultima/UltimaPhaseShell";
import { getAuthContext } from "@/lib/auth/session";
import { isCommissionerUser } from "@/lib/ultima/server/db";

export const metadata = {
  title: "Ultima · Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UltimaAdminPage() {
  const auth = await getAuthContext();
  if (!auth.isSignedIn) {
    redirect("/signin?next=/ultima/admin");
  }
  if (!isCommissionerUser(auth.user.id)) {
    redirect("/ultima");
  }

  return (
    <UltimaPhaseShell
      title="Commissioner"
      phase="J"
      lede="Invites, draft control, pool flags, and corrections."
    />
  );
}
