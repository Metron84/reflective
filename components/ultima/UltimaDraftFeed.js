import { ULTIMA_LEAGUE_SHORT } from "@/lib/ultima/constants";
import styles from "./ultima.module.css";

export default function UltimaDraftFeed({ picks = [] }) {
  const rows = [...picks].sort((a, b) => b.pick_number - a.pick_number);

  if (!rows.length) {
    return <p className={styles.deskMuted}>No picks yet.</p>;
  }

  return (
    <div className={styles.feedList}>
      {rows.map((p) => (
        <div key={p.pick_number} className={styles.feedRow}>
          <span>
            R{p.round} · #{p.pick_number}
            {p.forced ? " · Forced" : ""}
          </span>
          <span>
            {p.manager_name}
            {p.is_bot ? " · BOT" : ""}
          </span>
          <span>
            {p.player?.name}
            {p.player?.club ? ` · ${p.player.club}` : ""}
            {p.player?.league
              ? ` · ${ULTIMA_LEAGUE_SHORT[p.player.league] ?? p.player.league}`
              : ""}
          </span>
          {p.forced ? <span className={styles.feedForced}>Forced</span> : null}
          {p.rationale ? <span className={styles.feedBot}>{p.rationale}</span> : null}
        </div>
      ))}
    </div>
  );
}
