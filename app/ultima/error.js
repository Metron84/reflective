"use client";

import Link from "next/link";
import styles from "@/components/ultima/ultima.module.css";

export default function UltimaError({ reset }) {
  return (
    <div className={styles.ultimaPage}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>GAMES · ULTIMA</p>
        <h1 className={styles.title}>Ultima</h1>
        <p className={styles.lede}>The hub did not load. Try again, or open a door below.</p>
        <div className={styles.hubCta}>
          <button type="button" className={styles.primaryBtn} onClick={() => reset()}>
            Try again
          </button>
        </div>
        <p className={styles.hubNote}>
          <Link href="/ultima/join" className={styles.quietLink}>
            Join
          </Link>
          {" · "}
          <Link href="/ultima/rules" className={styles.quietLink}>
            Rules
          </Link>
          {" · "}
          <Link href="/games" className={styles.quietLink}>
            All games
          </Link>
        </p>
      </div>
    </div>
  );
}
