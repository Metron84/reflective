import UltimaProfileForm from "@/components/ultima/UltimaProfileForm";
import styles from "@/components/ultima/ultima.module.css";
import UltimaSeatRetry from "@/components/ultima/UltimaSeatRetry";
import { vapidPublicKey } from "@/lib/ultima/server/push";
import { requireSeat } from "@/lib/ultima/server/requireSeat";

export const metadata = {
  title: "Ultima · Profile",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UltimaProfilePage() {
  const seat = await requireSeat("/ultima/profile");
  if (seat.status === "unavailable") return <UltimaSeatRetry />;
  const { auth, manager } = seat;

  return (
    <div className={styles.ultimaPage}>
      <div className={`${styles.inner} ${styles.innerWide}`}>
        <UltimaProfileForm
          defaultManagerName={manager.manager_name || auth.profile?.preferred_name || ""}
          defaultTeamName={manager.team_name ?? ""}
          defaultColour={manager.colour ?? "navy"}
          defaultNotifyPrefs={manager.notify_prefs ?? null}
          vapidPublicKey={vapidPublicKey()}
        />
      </div>
    </div>
  );
}
