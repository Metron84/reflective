import UltimaMatchdayClient from "@/components/ultima/UltimaMatchdayClient";
import UltimaSeatRetry from "@/components/ultima/UltimaSeatRetry";
import styles from "@/components/ultima/ultima.module.css";
import { requireSeat } from "@/lib/ultima/server/requireSeat";
import { getMatchday } from "@/lib/ultima/server/matchday";
import { safeResolve } from "@/lib/ultima/server/safe";

export const metadata = {
  title: "Ultima · Matchday",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UltimaMatchdayPage() {
  const seat = await requireSeat("/ultima/matchday");
  if (seat.status === "unavailable") return <UltimaSeatRetry />;
  const { manager, competition } = seat;
  const initial =
    competition && manager
      ? await safeResolve(
          getMatchday({ competitionId: competition.id, managerId: manager.id }),
          null,
        )
      : null;

  return (
    <div className={styles.ultimaPage}>
      <div className={`${styles.inner} ${styles.innerWide}`}>
        <UltimaMatchdayClient initial={initial} />
      </div>
    </div>
  );
}
