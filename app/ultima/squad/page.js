import UltimaSquadClient from "@/components/ultima/UltimaSquadClient";
import styles from "@/components/ultima/ultima.module.css";
import UltimaSeatRetry from "@/components/ultima/UltimaSeatRetry";
import { requireSeat } from "@/lib/ultima/server/requireSeat";
import { getManagerRoster } from "@/lib/ultima/server/lineup";
import { getSquadOffice } from "@/lib/ultima/server/squad";
import { safeResolve } from "@/lib/ultima/server/safe";

export const metadata = {
  title: "Ultima · Squad",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UltimaSquadPage() {
  const seat = await requireSeat("/ultima/squad");
  if (seat.status === "unavailable") return <UltimaSeatRetry />;
  const { manager, competition } = seat;
  const [office, roster] =
    competition && manager
      ? await Promise.all([
          safeResolve(
            getSquadOffice({
              competitionId: competition.id,
              managerId: manager.id,
            }),
            null,
          ),
          // Fallback so a slow office query never hides the rostered players.
          safeResolve(getManagerRoster(manager.id), []),
        ])
      : [null, []];

  return (
    <div className={styles.ultimaPage}>
      <div className={`${styles.inner} ${styles.innerWide}`}>
        {office ? (
          <UltimaSquadClient office={office} />
        ) : (
          <UltimaSquadClient roster={roster} lineup={[]} noGameweek />
        )}
      </div>
    </div>
  );
}
