import { TREBLE_OVERALL } from "@/lib/treble";
import styles from "./treble.module.css";

export default function TrebleOverall() {
  return (
    <section
      className={`${styles.band} hero-grain`}
      aria-labelledby="treble-overall"
    >
      <div className={`${styles.inner} ${styles.bandInner}`}>
        <h2 id="treble-overall" className={styles.headline}>
          {TREBLE_OVERALL.headline}
        </h2>
        <ul className={styles.points}>
          {TREBLE_OVERALL.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
