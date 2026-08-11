import Link from "next/link";
import styles from "./LaLigaRibbon.module.css";

export default function LaLigaRibbon() {
  return (
    <Link href="/laliga" className={styles.ribbon}>
      <span className={styles.copy}>
        <span className={styles.mainRow}>
          <span className={styles.main} lang="es">
            LaLiga Nights está llegando a Dubái. Dinos a quién apoyas.
          </span>
          <span className={styles.arrow} aria-hidden="true">
            →
          </span>
        </span>
        <span className={styles.sub}>
          LaLiga Nights is coming to Dubai. Tell us your club.
        </span>
      </span>
    </Link>
  );
}
