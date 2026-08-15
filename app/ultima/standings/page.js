import Link from "next/link";
import { requireUltimaManager } from "@/lib/ultima/gates";
import { getActiveCompetition, getUltimaDb } from "@/lib/ultima/server/db";
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
  const db = getUltimaDb();

  const standings = competition ? await getStandings(competition.id) : [];
  const boltBoard = competition ? await getBoltBoard(competition.id) : [];

  const { data: botPersonas } = db
    ? await db.from("ultima_bot_personas").select("*")
    : { data: [] };

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
                  {row.is_bot ? " · BOT" : ""}
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

        <section className={styles.rulesSection}>
          <h2>Bot risk numbers</h2>
          <table className={styles.standingsTable}>
            <thead>
              <tr>
                <th>Bot</th>
                <th>Risk</th>
                <th>Horizon</th>
                <th>Discipline</th>
              </tr>
            </thead>
            <tbody>
              {(botPersonas ?? []).map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.risk}</td>
                  <td>{p.horizon}</td>
                  <td>{p.discipline}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <Link href="/ultima" className={styles.quietLink}>
          Back to hub
        </Link>
      </div>
    </div>
  );
}
