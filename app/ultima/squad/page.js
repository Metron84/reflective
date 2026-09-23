import UltimaSquadClient from "@/components/ultima/UltimaSquadClient";
import styles from "@/components/ultima/ultima.module.css";
import { requireUltimaManager } from "@/lib/ultima/gates";
import { getActiveCompetition } from "@/lib/ultima/server/db";
import { getSquadOffice } from "@/lib/ultima/server/squad";
import { safeResolve } from "@/lib/ultima/server/safe";

export const metadata = {
  title: "Ultima · Squad",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UltimaSquadPage() {
  const { manager } = await requireUltimaManager("/ultima/squad");
  const competition = await getActiveCompetition();
  const office =
    competition && manager
      ? await safeResolve(
          getSquadOffice({
            competitionId: competition.id,
            managerId: manager.id,
          }),
          null,
        )
      : null;

  return (
    <div className={styles.ultimaPage}>
      <div className={`${styles.inner} ${styles.innerWide}`}>
        {office ? (
          <UltimaSquadClient office={office} />
        ) : (
          <UltimaSquadClient roster={[]} lineup={[]} />
        )}
      </div>
    </div>
  );
}
