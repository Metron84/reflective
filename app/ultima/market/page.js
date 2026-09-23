import UltimaMarketClient from "@/components/ultima/UltimaMarketClient";
import styles from "@/components/ultima/ultima.module.css";
import { requireUltimaManager } from "@/lib/ultima/gates";
import { getActiveCompetition } from "@/lib/ultima/server/db";
import { getMarketOffice } from "@/lib/ultima/server/market";

export const metadata = {
  title: "Ultima · Market",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UltimaMarketPage() {
  const { manager } = await requireUltimaManager("/ultima/market");
  const competition = await getActiveCompetition();
  let office = null;
  if (competition && manager) {
    try {
      office = await getMarketOffice({
        competitionId: competition.id,
        managerId: manager.id,
      });
    } catch {
      office = null;
    }
  }

  return (
    <div className={styles.ultimaPage}>
      <div className={`${styles.inner} ${styles.innerWide}`}>
        <UltimaMarketClient office={office} />
      </div>
    </div>
  );
}
