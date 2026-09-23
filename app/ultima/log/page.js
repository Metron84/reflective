import UltimaLogClient from "@/components/ultima/UltimaLogClient";
import styles from "@/components/ultima/ultima.module.css";
import { requireUltimaManager } from "@/lib/ultima/gates";
import { getActiveCompetition } from "@/lib/ultima/server/db";
import { getOfficeLog } from "@/lib/ultima/server/admin";
import { safeResolve } from "@/lib/ultima/server/safe";

export const metadata = {
  title: "Ultima · Log",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UltimaLogPage() {
  await requireUltimaManager("/ultima/log");
  const competition = await getActiveCompetition();
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
