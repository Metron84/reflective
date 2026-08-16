import { requireUltimaManager } from "@/lib/ultima/gates";
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
        <p className={styles.eyebrow}>GAMES · ULTIMA</p>
        <h1 className={styles.title}>Standings</h1>

        <table className={styles.standingsTable}>
          <thead>
            <tr>
              <th>#</th>
              <th>Team</th>
              <th>GW</th>
              <th>Season</th>
              <th>Bolt</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row) => (
              <tr key={row.id}>
                <td>{row.rank}</td>
                <td>
                  <span
                    className={styles.colourDot}
                    style={{ background: row.colour === "navy" ? "#0A111F" : "#4A5568" }}
                  />
                  {row.team_name}
                  {row.is_bot
                    ? ` · BOT${row.persona_name ? ` · ${row.persona_name}` : ""}`
                    : ""}
                </td>
                <td>{row.gameweekPoints ?? "—"}</td>
                <td>{row.seasonPoints}</td>
                <td>{row.boltPoints}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {standings.length === 0 ? (
          <p className={styles.lede}>No scores yet. Set your XI for the first gameweek.</p>
        ) : null}

        <section className={styles.rulesSection}>
          <h2>Bolt board</h2>
          {boltBoard.length === 0 ? (
            <p>No Bolt bonuses yet.</p>
          ) : (
            <ul>
              {boltBoard.map((b) => (
                <li key={b.manager_id}>
                  {b.team_name}: {b.bolt} Bolt pts
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
