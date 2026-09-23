"use client";

import Link from "next/link";
import UltimaStaffMessage from "@/components/ultima/UltimaStaffMessage";
import styles from "@/components/ultima/ultima.module.css";

export default function UltimaError({ reset }) {
  return (
    <div className={styles.ultimaPage}>
      <div className={styles.inner}>
        <UltimaStaffMessage
          subject="The hub did not load"
          body="Try again, or open Join, Rules, or All games."
          actionLabel="Try again"
          onAction={() => reset()}
        />
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
