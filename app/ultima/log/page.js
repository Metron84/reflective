import UltimaLogClient from "@/components/ultima/UltimaLogClient";
import styles from "@/components/ultima/ultima.module.css";
import UltimaSeatRetry from "@/components/ultima/UltimaSeatRetry";
import { requireSeat } from "@/lib/ultima/server/requireSeat";
import { getOfficeLog } from "@/lib/ultima/server/admin";
import { safeResolve } from "@/lib/ultima/server/safe";

export const metadata = {
  title: "Ultima · Log",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UltimaLogPage() {
  const seat = await requireSeat("/ultima/log");
  if (seat.status === "unavailable") return <UltimaSeatRetry />;
  const { competition } = seat;
  const entries = competition
    ? await safeResolve(getOfficeLog(competition.id, 120), [])
    : [];

  return (
    <div className={styles.ultimaPage}>
      <div className={`${styles.inner} ${styles.innerWide}`}>
        <UltimaLogClient entries={entries} />
      </div>
    </div>
  );
}
