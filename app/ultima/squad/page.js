import UltimaSquadClient from "@/components/ultima/UltimaSquadClient";
import { requireUltimaManager } from "@/lib/ultima/gates";
import { getActiveCompetition } from "@/lib/ultima/server/db";
import {
  getManagerRoster,
  getLineup,
  ensureLineupExists,
  isLeagueLocked,
} from "@/lib/ultima/server/lineup";
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
  let lineup = gameweek
    ? await ensureLineupExists(manager.id, gameweek.id)
    : [];

  const lockedLeagues = ["pl", "laliga", "seriea"].filter((l) =>
    gameweek ? isLeagueLocked(gameweek, l) : false,
  );

  return (
    <div className={styles.ultimaPage}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>GAMES · ULTIMA</p>
        <h1 className={styles.title}>My squad</h1>
        {roster.length === 0 ? (
          <p className={styles.lede}>Your squad fills on draft night.</p>
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
