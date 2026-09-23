import UltimaTradesClient from "@/components/ultima/UltimaTradesClient";
import UltimaStaffMessage from "@/components/ultima/UltimaStaffMessage";
import styles from "@/components/ultima/ultima.module.css";
import { requireUltimaManager } from "@/lib/ultima/gates";
import { getActiveCompetition } from "@/lib/ultima/server/db";
import { getTradeOffice } from "@/lib/ultima/server/trades";

export const metadata = {
  title: "Ultima · Trade",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UltimaTradeDetailPage({ params }) {
  const { manager } = await requireUltimaManager("/ultima/trades");
  const { id } = await params;
  const competition = await getActiveCompetition();
  let office = null;
  if (competition && manager) {
    try {
      office = await getTradeOffice({
        competitionId: competition.id,
        managerId: manager.id,
      });
    } catch {
      office = null;
    }
  }

  const found = office?.offers?.some((offer) => offer.id === id);

  return (
    <div className={styles.ultimaPage}>
      <div className={`${styles.inner} ${styles.innerWide}`}>
        {office && found ? (
          <UltimaTradesClient office={office} selectedId={id} />
        ) : (
          <UltimaStaffMessage
            subject="That trade is not on the desk"
            body="It may have been removed. Open the trade list."
            actionLabel="Trades"
            href="/ultima/trades"
          />
        )}
      </div>
    </div>
  );
}
