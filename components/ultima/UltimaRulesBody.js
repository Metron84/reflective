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

      <h2>Access</h2>
      <p>Invite only. Ten seats. Sign in, then enter the invite password at <Link href="/ultima/join">/ultima/join</Link>.</p>

      <h2>Draft</h2>
      <ul>
        <li>Live snake draft, 30 rounds, 300 picks across 10 managers.</li>
        <li>Minimum 3 players from each league by the end of the draft.</li>
        <li>Timer auto-picks from your queue if it expires.</li>
      </ul>

      <h2>Market and trades</h2>
      <ul>
        <li>Free agency opens when the draft completes. Every add requires a drop.</li>
        <li>Trades open from gameweek 4. Equal player counts. 24 hour league review.</li>
      </ul>

      <h2>Squad and XV floors (v5)</h2>
      <ul>
        <li>30-man squad. Minimum 3 players from each of the five leagues.</li>
        <li>Starting XV of 15. Exactly 3 from each league. All fifteen score.</li>
        <li>Bench players score zero.</li>
      </ul>

      <h2>Locking</h2>
      <p>
        Each league locks at its first kickoff inside the gameweek window (Friday 00:00 to
        Thursday 23:59 GST). A slot locks when the league of the player in it opens.
      </p>

      <h2>Leagues</h2>
      <p>
        Premier League, LaLiga, Serie A, Bundesliga, and Ligue 1. Invite only. Ten seats.
        Thirty draft rounds.
      </p>

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
