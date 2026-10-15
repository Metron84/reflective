import { TREBLE_FOOTER } from "@/lib/treble";
import styles from "./treble.module.css";

export default function TrebleFooterLine() {
  return (
    <section
      className={`${styles.section} ${styles.divided}`}
      aria-label="Tagline"
    >
      <div className={`${styles.inner} ${styles.footerInner}`}>
        <p className={styles.footerLine}>{TREBLE_FOOTER.line}</p>
      </div>
    </section>
  );
}
