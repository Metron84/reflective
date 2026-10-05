import UltimaLogClient from "@/components/ultima/UltimaLogClient";
import styles from "@/components/ultima/ultima.module.css";
import UltimaDidNotLoad from "@/components/ultima/UltimaDidNotLoad";
import UltimaSeatRetry from "@/components/ultima/UltimaSeatRetry";
import { requireSeat } from "@/lib/ultima/server/requireSeat";
import { getOfficeLog } from "@/lib/ultima/server/admin";
import { loadStrict } from "@/lib/ultima/server/safe";

export const metadata = {
  title: "Ultima · Log",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UltimaLogPage() {
  const seat = await requireSeat("/ultima/log");
  if (seat.status === "unavailable") return <UltimaSeatRetry />;
  const { competition } = seat;
  let entries = [];
  try {
    entries = competition ? await loadStrict(getOfficeLog(competition.id, 120), 12000) : [];
  } catch {
    return <UltimaDidNotLoad subject="The log" />;
  }

  return (
    <div className={styles.ultimaPage}>
      <div className={`${styles.inner} ${styles.innerWide}`}>
        <UltimaLogClient entries={entries} />
      </div>
    </div>
  );
}
