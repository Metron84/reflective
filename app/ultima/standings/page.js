import UltimaTableClient from "@/components/ultima/UltimaTableClient";
import styles from "@/components/ultima/ultima.module.css";
import UltimaSeatRetry from "@/components/ultima/UltimaSeatRetry";
import { requireSeat } from "@/lib/ultima/server/requireSeat";
import { safeResolve } from "@/lib/ultima/server/safe";
import { getTableOffice } from "@/lib/ultima/server/table";

export const metadata = {
  title: "Ultima · Table",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UltimaStandingsPage() {
  const seat = await requireSeat("/ultima/standings");
  if (seat.status === "unavailable") return <UltimaSeatRetry />;
  const { manager, competition } = seat;
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
