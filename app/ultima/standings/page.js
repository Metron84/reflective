import UltimaTableClient from "@/components/ultima/UltimaTableClient";
import styles from "@/components/ultima/ultima.module.css";
import { requireUltimaManager } from "@/lib/ultima/gates";
import { getActiveCompetition } from "@/lib/ultima/server/db";
import { safeResolve } from "@/lib/ultima/server/safe";
import { getTableOffice } from "@/lib/ultima/server/table";

export const metadata = {
  title: "Ultima · Table",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UltimaStandingsPage() {
  const { manager } = await requireUltimaManager("/ultima/standings");
  const competition = await getActiveCompetition();
  const office =
    competition && manager
      ? await safeResolve(
          getTableOffice({
            competitionId: competition.id,
            managerId: manager.id,
          }),
          null,
        )
      : null;

  return (
    <div className={styles.ultimaPage}>
      <div className={`${styles.inner} ${styles.innerWide}`}>
        <UltimaTableClient office={office} />
      </div>
    </div>
  );
}
