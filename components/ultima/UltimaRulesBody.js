import Link from "next/link";
import styles from "./ultima.module.css";

export default function UltimaRulesBody() {
  return (
    <div className={styles.rulesSection}>
      <h2>Scoring</h2>
      <table className={styles.rulesTable}>
        <thead>
          <tr>
            <th>Event</th>
            <th>Points</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Goal</td>
            <td>3</td>
          </tr>
          <tr>
            <td>Assist</td>
            <td>1</td>
          </tr>
          <tr>
            <td>Match rating 7.0 to 7.4</td>
            <td>1</td>
          </tr>
          <tr>
            <td>Match rating 7.5 and above</td>
            <td>2</td>
          </tr>
          <tr>
            <td>Bolt bonus (round 16+ or undrafted FA, 6+ base in a GW)</td>
            <td>+2</td>
          </tr>
        </tbody>
      </table>

      <h2>Squad and XI floors</h2>
      <ul>
        <li>25-man squad. Minimum 4 players from each league.</li>
        <li>Starting XI of 11. Minimum 3 from each league, plus 2 free slots.</li>
        <li>Only the XI scores. Bench players score zero.</li>
      </ul>

      <h2>Locking</h2>
      <p>
        Each league locks at its first kickoff inside the gameweek window (Friday 00:00 to
        Thursday 23:59 GST). A slot locks when the league of the player in it opens.
      </p>

      <h2>Leagues</h2>
      <p>Premier League, LaLiga, and Serie A only. Invite only. Ten seats.</p>

      <p className={styles.phaseNote}>
        Rating thresholds may be calibrated per league once the season study is signed off.
        See the master spec for the full rulebook.
      </p>

      <p className={styles.hubNote}>
        <Link href="/ultima" className={styles.quietLink}>
          Back to Ultima
        </Link>
      </p>
    </div>
  );
}
