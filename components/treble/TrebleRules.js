import { TREBLE_RULES } from "@/lib/treble";
import styles from "./treble.module.css";

export default function TrebleRules() {
  const last = TREBLE_RULES.points.length - 1;

  return (
    <section
      className={`${styles.section} ${styles.divided}`}
      aria-labelledby="treble-rules"
    >
      <div className={styles.inner}>
        <h2 id="treble-rules" className={styles.headline}>
          {TREBLE_RULES.headline}
        </h2>
        <ul className={styles.points}>
          {TREBLE_RULES.points.map((point, index) => (
            <li key={point} className={index === last ? styles.sanction : undefined}>
              {point}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
