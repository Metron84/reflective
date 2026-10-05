import UltimaTradesClient from "@/components/ultima/UltimaTradesClient";
import styles from "@/components/ultima/ultima.module.css";
import UltimaSeatRetry from "@/components/ultima/UltimaSeatRetry";
import { requireSeat } from "@/lib/ultima/server/requireSeat";
import { getTradeOffice } from "@/lib/ultima/server/trades";

export const metadata = {
  title: "Ultima · Trades",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UltimaTradesPage() {
  const seat = await requireSeat("/ultima/trades");
  if (seat.status === "unavailable") return <UltimaSeatRetry />;
  const { manager, competition } = seat;
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

  return (
    <div className={styles.ultimaPage}>
      <div className={`${styles.inner} ${styles.innerWide}`}>
        <UltimaTradesClient office={office} />
      </div>
    </div>
  );
}
