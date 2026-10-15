import Link from "next/link";
import { TREBLE_HERO } from "@/lib/treble";
import styles from "./treble.module.css";

export default function TrebleHero() {
  return (
    <section className={styles.section} aria-labelledby="treble-title">
      <div className={styles.inner}>
        <p className={styles.eyebrow}>{TREBLE_HERO.eyebrow}</p>
        <h1 id="treble-title" className={styles.title}>
          {TREBLE_HERO.title}
        </h1>
        <blockquote className={styles.quote}>
          <p>{TREBLE_HERO.quote}</p>
          <footer className={styles.attribution}>{TREBLE_HERO.attribution}</footer>
        </blockquote>
        <p className={styles.subhead}>{TREBLE_HERO.subhead}</p>
        <div className={styles.actions}>
          <Link href={TREBLE_HERO.enterHref} className={styles.primary}>
            {TREBLE_HERO.enterClub}
          </Link>
          <Link href={TREBLE_HERO.hostHref} className={styles.secondary}>
            {TREBLE_HERO.hostSponsor}
          </Link>
        </div>
      </div>
    </section>
  );
}
