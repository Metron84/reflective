import Link from "next/link";
import styles from "./ultima.module.css";

export default function UltimaDoor({ href, label, status, external = false }) {
  const inner = (
    <>
      <span className={styles.doorMain}>
        <span className={styles.doorLabel}>{label}</span>
        {status ? <span className={styles.doorStatus}>{status}</span> : null}
      </span>
      <span className={styles.doorArrow} aria-hidden="true">
        →
      </span>
    </>
  );

  if (external) {
    return (
      <a
        href={href}
        className={styles.door}
        target="_blank"
        rel="noopener noreferrer"
      >
        {inner}
      </a>
    );
  }

  return (
    <Link href={href} className={styles.door}>
      {inner}
    </Link>
  );
}
