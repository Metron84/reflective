import UltimaTradesClient from "@/components/ultima/UltimaTradesClient";
import UltimaStaffMessage from "@/components/ultima/UltimaStaffMessage";
import styles from "@/components/ultima/ultima.module.css";
import UltimaSeatRetry from "@/components/ultima/UltimaSeatRetry";
import { requireSeat } from "@/lib/ultima/server/requireSeat";
import { getTradeOffice } from "@/lib/ultima/server/trades";

export const metadata = {
  title: "Ultima · Trade",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UltimaTradeDetailPage({ params }) {
  const seat = await requireSeat("/ultima/trades");
  if (seat.status === "unavailable") return <UltimaSeatRetry />;
  const { manager, competition } = seat;
  const { id } = await params;
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
