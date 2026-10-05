import UltimaMatchdayClient from "@/components/ultima/UltimaMatchdayClient";
import UltimaSeatRetry from "@/components/ultima/UltimaSeatRetry";
import styles from "@/components/ultima/ultima.module.css";
import { requireSeat } from "@/lib/ultima/server/requireSeat";
import { getMatchday } from "@/lib/ultima/server/matchday";
import { loadStrict } from "@/lib/ultima/server/safe";

export const metadata = {
  title: "Ultima · Matchday",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UltimaMatchdayPage() {
  const seat = await requireSeat("/ultima/matchday");
  if (seat.status === "unavailable") return <UltimaSeatRetry />;
  const { manager, competition } = seat;
  let initial = null;
  try {
    initial =
      competition && manager
        ? await loadStrict(getMatchday({ competitionId: competition.id, managerId: manager.id }), 12000)
        : null;
  } catch {
    initial = null; // the client says "Matchday did not load"
  }

  return (
    <div className={styles.ultimaPage}>
      <div className={`${styles.inner} ${styles.innerWide}`}>
        <UltimaMatchdayClient initial={initial} />
      </div>
    </div>
  );
}
