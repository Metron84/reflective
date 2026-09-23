import Link from "next/link";
import styles from "./ultima.module.css";

export default function UltimaClubBar({ teamName, seasonLine, continueAction, sample = false }) {
  const action = continueAction ?? { label: "Go to hub", href: "/ultima" };

  return (
    <header className={styles.clubBar}>
      <div className={styles.clubBarCopy}>
        <p className={styles.clubSeason}>
          {seasonLine || "Ultima"}
          {sample ? <span className={styles.sampleChip}>SAMPLE</span> : null}
        </p>
        <p className={styles.clubName}>{teamName || "Ultima"}</p>
      </div>
      <Link href={action.href} className={styles.continueBtn}>
        {action.label}
      </Link>
    </header>
  );
}
