import UltimaRulesBody from "@/components/ultima/UltimaRulesBody";
import UltimaRulesOffice from "@/components/ultima/UltimaRulesOffice";
import styles from "@/components/ultima/ultima.module.css";
import { getAuthContext } from "@/lib/auth/session";
import { ULTIMA_ENABLED } from "@/lib/config";
import { getManagerForUser } from "@/lib/ultima/server/db";

export const metadata = {
  title: "Ultima · Rules",
  description: "Canonical scoring, floors and locks for Ultima.",
  alternates: { canonical: "/ultima/rules" },
  robots: ULTIMA_ENABLED ? undefined : { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UltimaRulesPage() {
  const auth = await getAuthContext();
  const manager =
    auth.isSignedIn && auth.user ? await getManagerForUser(auth.user.id) : null;

  if (manager) {
    return (
      <div className={styles.ultimaPage}>
        <div className={`${styles.inner} ${styles.innerWide}`}>
          <UltimaRulesOffice />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.ultimaPage}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>GAMES · ULTIMA</p>
        <h1 className={styles.title}>Rules</h1>
        <UltimaRulesBody />
      </div>
    </div>
  );
}
