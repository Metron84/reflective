import Link from "next/link";
import styles from "./CrestSection.module.css";

/**
 * @param {{crest: {clubName: string, roomPct: number, stakeLabel?: string|null}|null}} props
 */
export default function CrestSection({ crest }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>The Crest</h2>
      {crest ? (
        <>
          <p className={styles.club}>{crest.clubName}</p>
          <p className={styles.meta}>
            {crest.roomPct}% of the last room
            {crest.stakeLabel ? ` · You wanted ${crest.stakeLabel.toLowerCase()}` : ""}
          </p>
          <div className={styles.row}>
            <Link href="/crest" className={styles.primary}>
              Open your results
            </Link>
            <Link href="/crest" className={styles.ghost}>
              Swipe again
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className={styles.empty}>Eighteen swipes. One club that sounds like you.</p>
          <Link href="/crest" className={styles.primary}>
            Find my club
          </Link>
        </>
      )}
    </section>
  );
}
