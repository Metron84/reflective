import { TREBLE_LEGS, TREBLE_WIN_LABEL } from "@/lib/treble";
import styles from "./treble.module.css";

export default function TrebleLegs() {
  return (
    <section className={`${styles.section} ${styles.divided}`} aria-label="The three legs">
      <div className={styles.inner}>
        <ul className={styles.legs}>
          {TREBLE_LEGS.map((leg) => (
            <li key={leg.id} className={styles.leg}>
              <p className={styles.kicker}>{leg.label}</p>
              <h2 className={styles.legTitle}>{leg.title}</h2>
              <p className={styles.tagline}>{leg.tagline}</p>
              <ul className={`${styles.points} ${styles.legPoints}`}>
                {leg.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              <div className={styles.win}>
                <hr className={styles.winRule} />
                <p className={styles.winLabel}>{TREBLE_WIN_LABEL}</p>
                <p className={styles.winText}>{leg.win}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
