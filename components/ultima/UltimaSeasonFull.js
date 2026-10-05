import Link from "next/link";
import UltimaStaffMessage from "./UltimaStaffMessage";
import styles from "./ultima.module.css";

export default function UltimaSeasonFull() {
  return (
    <div className={styles.ultimaPage}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>GAMES · ULTIMA</p>
        <h1 className={styles.title}>Season full</h1>
        <UltimaStaffMessage
          subject="Season full"
          body="The season is full. Ask the commissioner about the next one."
        />
        <p className={styles.hubNote}>
          <Link href="/ultima/rules" className={styles.quietLink}>
            Read the rules
          </Link>
        </p>
      </div>
    </div>
  );
}
