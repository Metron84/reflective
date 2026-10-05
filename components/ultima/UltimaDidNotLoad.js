"use client";

import { useRouter } from "next/navigation";
import UltimaStaffMessage from "./UltimaStaffMessage";
import styles from "./ultima.module.css";

/** Shown when a page read failed. Never an empty list that looks like real data. */
export default function UltimaDidNotLoad({ subject = "This page" }) {
  const router = useRouter();
  return (
    <div className={styles.ultimaPage}>
      <div className={`${styles.inner} ${styles.innerWide}`}>
        <UltimaStaffMessage
          subject={`${subject} did not load`}
          body="Nothing was changed. Try again."
          actionLabel="Retry"
          onAction={() => router.refresh()}
        />
      </div>
    </div>
  );
}
