import { TREBLE_CLUB_GAINS } from "@/lib/treble";
import styles from "./treble.module.css";

export default function TrebleClubGains() {
  return (
    <section className={styles.section} aria-labelledby="treble-club-gains">
      <div className={styles.inner}>
        <h2 id="treble-club-gains" className={styles.headline}>
          {TREBLE_CLUB_GAINS.headline}
        </h2>
        <ul className={styles.points}>
          {TREBLE_CLUB_GAINS.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
