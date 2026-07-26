import { SOCIAL_LINKS } from "@/lib/config";
import styles from "./FilmsWatchWays.module.css";

/**
 * Dual platform handoff after the three picks.
 * Replaces the on-page archive grid (FilmsArchive kept in codebase, not rendered).
 */
export default function FilmsWatchWays() {
  return (
    <section className={styles.section} aria-labelledby="films-watch-ways-heading">
      <div className={styles.inner}>
        <p className={styles.eyebrow}>Two ways to watch</p>
        <h2 id="films-watch-ways-heading" className={styles.line}>
          Full episodes. Fast reels. One community.
        </h2>

        <ul className={styles.list}>
          <li>
            <a
              href={SOCIAL_LINKS.youtube}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.card}
            >
              <p className={styles.label}>Full episodes</p>
              <p className={styles.copy}>Sit down for the whole story.</p>
              <span className={styles.cta}>Watch on YouTube</span>
            </a>
          </li>
          <li>
            <a
              href={SOCIAL_LINKS.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.card}
            >
              <p className={styles.label}>Fast reels</p>
              <p className={styles.copy}>Catch it in seconds.</p>
              <span className={styles.cta}>Follow on Instagram</span>
            </a>
          </li>
        </ul>
      </div>
    </section>
  );
}
