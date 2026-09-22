import UltimaRoomHead from "@/components/ultima/UltimaRoomHead";
import { requireUltimaManager } from "@/lib/ultima/gates";
import { ultimaColourHex } from "@/lib/ultima/constants";
import { getActiveCompetition } from "@/lib/ultima/server/db";
import {
  getStandings,
  getBoltBoard,
} from "@/lib/ultima/server/scoring-run";
import styles from "@/components/ultima/ultima.module.css";

export const metadata = {
  title: "Ultima · Standings",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UltimaStandingsPage() {
  await requireUltimaManager("/ultima/standings");
  const competition = await getActiveCompetition();

  const standings = competition ? await getStandings(competition.id) : [];
  const boltBoard = competition ? await getBoltBoard(competition.id) : [];

  return (
    <div className={styles.ultimaPage}>
      <div className={styles.inner}>
        <UltimaRoomHead title="Table" kicker="League" />

        <section className={styles.officePanel} aria-label="Ultima table">
          {standings.length === 0 ? (
            <p className={styles.hubNote}>No scores yet. Set your XI for the first gameweek.</p>
          ) : (
            <ol className={styles.tableBoard}>
              {standings.map((row) => (
                <li key={row.id} className={styles.tableBoardRow}>
                  <span className={styles.tablePos}>{row.rank}</span>
                  <span className={styles.tableBoardTeam}>
                    <span
                      className={styles.colourDot}
                      style={{ background: ultimaColourHex(row.colour) }}
                    />
                    {row.team_name}
                    {row.is_bot
                      ? ` · BOT${row.persona_name ? ` · ${row.persona_name}` : ""}`
                      : ""}
                  </span>
                  <span className={styles.tableBoardPts}>
                    <span className={styles.inboxStamp}>GW</span>
                    {row.gameweekPoints ?? "—"}
                  </span>
                  <span className={styles.tableBoardPts}>
                    <span className={styles.inboxStamp}>Season</span>
                    {row.seasonPoints}
                  </span>
                  <span className={styles.tableBoardPts}>
                    <span className={styles.inboxStamp}>Bolt</span>
                    {row.boltPoints}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className={styles.officePanel} aria-label="Bolt board">
          <h2 className={styles.panelTitle}>Bolt board</h2>
          {boltBoard.length === 0 ? (
            <p className={styles.hubNote}>No Bolt bonuses yet.</p>
          ) : (
            <ul className={styles.inboxList}>
              {boltBoard.map((b) => (
                <li key={b.manager_id} className={styles.inboxItem}>
                  <span className={styles.inboxStamp}>Bolt</span>
                  <span className={styles.inboxLine}>{b.team_name}</span>
                  <span className={styles.inboxMeta}>{b.bolt} pts</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
