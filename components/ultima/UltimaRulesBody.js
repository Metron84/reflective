import Link from "next/link";
import {
  RULES_DRAFT,
  RULES_FLOOR,
  RULES_LEAGUES,
  RULES_LOCKING,
  RULES_NOTE,
  RULES_SCORING_ROWS,
  RULES_TRADE,
} from "@/lib/ultima/rules-content";
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
          {RULES_SCORING_ROWS.map((row) => (
            <tr key={row.event}>
              <td>{row.event}</td>
              <td>{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Access</h2>
      <p>
        Invite only. Ten seats. Sign in, then enter the invite password at{" "}
        <Link href="/ultima/join">/ultima/join</Link>.
      </p>

      <h2>Draft</h2>
      <ul>
        {RULES_DRAFT.map((line) =>
          line.includes("/ultima/practice") ? (
            <li key={line}>
              Practise first at <Link href="/ultima/practice">/ultima/practice</Link>. Solo vs bots, or
              a shared room. Practice picks do not count.
            </li>
          ) : (
            <li key={line}>{line}</li>
          ),
        )}
      </ul>

      <h2>Market and trades</h2>
      <ul>
        {RULES_TRADE.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>

      <h2>Squad and XV floors (v5)</h2>
      <ul>
        {RULES_FLOOR.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>

      <h2>Locking</h2>
      <p>{RULES_LOCKING}</p>

      <h2>Leagues</h2>
      <p>{RULES_LEAGUES}</p>

      <p className={styles.phaseNote}>{RULES_NOTE}</p>
    </div>
  );
}
