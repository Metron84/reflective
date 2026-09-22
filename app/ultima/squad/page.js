import UltimaSquadClient from "@/components/ultima/UltimaSquadClient";
import UltimaRoomHead from "@/components/ultima/UltimaRoomHead";
import { ULTIMA_LEAGUES } from "@/lib/ultima/constants";
import { requireUltimaManager } from "@/lib/ultima/gates";
import { getActiveCompetition } from "@/lib/ultima/server/db";
import {
  getManagerRoster,
  ensureLineupExists,
  isLeagueLocked,
} from "@/lib/ultima/server/lineup";
import { emptyLineupTemplate } from "@/lib/ultima/lineup/slots";
import { getCurrentGameweek } from "@/lib/ultima/server/bootstrap";
import styles from "@/components/ultima/ultima.module.css";

export const metadata = {
  title: "Ultima · Squad",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UltimaSquadPage() {
  const { manager } = await requireUltimaManager("/ultima/squad");
  const competition = await getActiveCompetition();
  const gameweek = competition ? await getCurrentGameweek(competition.id) : null;

  const roster = await getManagerRoster(manager.id);
  const lineup = gameweek
    ? await ensureLineupExists(manager.id, gameweek.id)
    : emptyLineupTemplate();

  const lockedLeagues = ULTIMA_LEAGUES.filter((l) =>
    gameweek ? isLeagueLocked(gameweek, l) : false,
  );

  return (
    <div className={styles.ultimaPage}>
      <div className={styles.inner}>
        {roster.length === 0 ? (
          <>
            <UltimaRoomHead title="Squad" kicker="Office" />
            <section className={styles.officePanel}>
              <p className={styles.hubNote}>Your squad fills on draft night.</p>
            </section>
          </>
        ) : (
          <UltimaSquadClient
            roster={roster}
            lineup={lineup}
            gameweek={gameweek}
            lockedLeagues={lockedLeagues}
          />
        )}
      </div>
    </div>
  );
}
