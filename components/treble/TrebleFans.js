import { TREBLE_FANS } from "@/lib/treble";
import styles from "./treble.module.css";

export default function TrebleFans() {
  return (
    <section
      className={`${styles.section} ${styles.divided}`}
      aria-labelledby="treble-fans"
    >
      <div className={styles.inner}>
        <h2 id="treble-fans" className={styles.headline}>
          {TREBLE_FANS.headline}
        </h2>
        <ul className={styles.points}>
          {TREBLE_FANS.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
