"use client";

import { useRouter } from "next/navigation";
import UltimaStaffMessage from "./UltimaStaffMessage";
import styles from "./ultima.module.css";

export default function UltimaSeatRetry() {
  const router = useRouter();
  return (
    <div className={styles.ultimaPage}>
      <div className={styles.inner}>
        <UltimaStaffMessage
          subject="Seat"
          body="Couldn't load your seat. Try again."
          actionLabel="Retry"
          onAction={() => router.refresh()}
        />
      </div>
    </div>
  );
}
