import UltimaSquadClient from "@/components/ultima/UltimaSquadClient";
import styles from "@/components/ultima/ultima.module.css";
import UltimaDidNotLoad from "@/components/ultima/UltimaDidNotLoad";
import UltimaSeatRetry from "@/components/ultima/UltimaSeatRetry";
import { requireSeat } from "@/lib/ultima/server/requireSeat";
import { getSquadOffice } from "@/lib/ultima/server/squad";
import { loadStrict } from "@/lib/ultima/server/safe";

export const metadata = {
  title: "Ultima · Squad",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Remount the client when the squad or XV changes on the server (card actions, trades). */
function squadKey(office) {
  const xv = (office.lineup ?? []).map((r) => `${r.player_id ?? "-"}${r.is_captain ? "c" : ""}`).join(".");
  return `${office.players.map((p) => p.id).join(",")}|${xv}`;
}

export default async function UltimaSquadPage() {
  const seat = await requireSeat("/ultima/squad");
  if (seat.status === "unavailable") return <UltimaSeatRetry />;
  const { manager, competition } = seat;
  let office = null;
  try {
    office =
      competition && manager
        ? await loadStrict(getSquadOffice({ competitionId: competition.id, managerId: manager.id }), 12000)
        : null;
  } catch {
    office = null;
  }
  if (!office) return <UltimaDidNotLoad subject="Your squad" />;

  return (
    <div className={styles.ultimaPage}>
      <div className={`${styles.inner} ${styles.innerWide}`}>
        <UltimaSquadClient key={squadKey(office)} office={office} />
      </div>
    </div>
  );
}
