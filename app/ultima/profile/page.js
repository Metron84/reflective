import UltimaProfileForm from "@/components/ultima/UltimaProfileForm";
import styles from "@/components/ultima/ultima.module.css";
import { requireUltimaManager } from "@/lib/ultima/gates";

export const metadata = {
  title: "Ultima · Profile",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UltimaProfilePage() {
  const { auth, manager } = await requireUltimaManager("/ultima/profile");

  return (
    <div className={styles.ultimaPage}>
      <div className={`${styles.inner} ${styles.innerWide}`}>
        <UltimaProfileForm
          defaultManagerName={manager.manager_name || auth.profile?.preferred_name || ""}
          defaultTeamName={manager.team_name ?? ""}
          defaultColour={manager.colour ?? "navy"}
          defaultNotifyPrefs={manager.notify_prefs ?? null}
        />
      </div>
    </div>
  );
}
