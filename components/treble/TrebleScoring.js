import { TREBLE_SCORING } from "@/lib/treble";
import styles from "./treble.module.css";

export default function TrebleScoring() {
  return (
    <section
      className={`${styles.section} ${styles.divided}`}
      aria-labelledby="treble-scoring"
    >
      <div className={styles.inner}>
        <h2 id="treble-scoring" className={styles.headline}>
          {TREBLE_SCORING.headline}
        </h2>
        <div className={styles.shares}>
          {TREBLE_SCORING.legs.map((leg) => (
            <div key={leg.id} className={styles.share}>
              <p className={styles.shareValue}>{TREBLE_SCORING.share}</p>
              <p className={styles.shareName}>{leg.name}</p>
            </div>
          ))}
        </div>
        <ul className={styles.points}>
          {TREBLE_SCORING.rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
