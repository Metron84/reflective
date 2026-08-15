import { redirect } from "next/navigation";
import UltimaAdminClient from "@/components/ultima/UltimaAdminClient";
import { getAuthContext } from "@/lib/auth/session";
import { getActiveCompetition, isCommissionerUser } from "@/lib/ultima/server/db";
import styles from "@/components/ultima/ultima.module.css";

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

  const competition = await getActiveCompetition();

  return (
    <div className={styles.ultimaPage}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>GAMES · ULTIMA · ADMIN</p>
        <h1 className={styles.title}>Commissioner</h1>
        <UltimaAdminClient seasonLabel={competition?.season_label ?? "2026/27"} />
      </div>
    </div>
  );
}
