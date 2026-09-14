import Link from "next/link";
import { KOTB_PATH } from "@/lib/kotb";
import styles from "./KotbRibbon.module.css";

export default function KotbRibbon() {
  return (
    <Link href={`${KOTB_PATH}#apply`} className={styles.ribbon}>
      <span className={styles.copy}>
        <span className={styles.mainRow}>
          <span className={styles.main}>
            Eight Dubai burgers. Two supporters clubs judging each. Apply free.
          </span>
          <span className={styles.arrow} aria-hidden="true">
            →
          </span>
        </span>
      </span>
    </Link>
  );
}
