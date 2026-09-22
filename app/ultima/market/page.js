import UltimaMarketClient from "@/components/ultima/UltimaMarketClient";
import UltimaRoomHead from "@/components/ultima/UltimaRoomHead";
import { requireUltimaManager } from "@/lib/ultima/gates";
import { getActiveCompetition } from "@/lib/ultima/server/db";
import { getFreeAgents } from "@/lib/ultima/server/players";
import { getManagerRoster } from "@/lib/ultima/server/lineup";
import { getUltimaDb } from "@/lib/ultima/server/db";
import styles from "@/components/ultima/ultima.module.css";

export const metadata = {
  title: "Ultima · Market",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UltimaMarketPage() {
  const { manager } = await requireUltimaManager("/ultima/market");
  const competition = await getActiveCompetition();

  const db = getUltimaDb();
  const { data: draftState } = competition
    ? await db
        .from("ultima_draft_state")
        .select("state")
        .eq("competition_id", competition.id)
        .maybeSingle()
    : { data: null };

  const roster = await getManagerRoster(manager.id);
  const freeAgents = competition ? await getFreeAgents(competition.id) : [];

  return (
    <div className={styles.ultimaPage}>
      <div className={styles.inner}>
        <UltimaRoomHead title="Market" kicker="Transfer" />
        {draftState?.state !== "complete" ? (
          <section className={styles.officePanel}>
            <p className={styles.hubNote}>Free agents open after the draft completes.</p>
          </section>
        ) : (
          <UltimaMarketClient freeAgents={freeAgents} roster={roster} />
        )}
      </div>
    </div>
  );
}
