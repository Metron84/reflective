import Link from "next/link";
import styles from "./AdminNav.module.css";

export default function AdminNav({ active, newCount = 0 }) {
  return (
    <nav className={styles.nav} aria-label="Admin">
      <Link
        href="/admin/tagging"
        className={active === "tagging" ? styles.active : styles.link}
      >
        Tagging
      </Link>
      <Link
        href="/admin/messages"
        className={active === "messages" ? styles.active : styles.link}
      >
        Messages
        {newCount > 0 ? (
          <span className={styles.badge} aria-label={`${newCount} new`}>
            {newCount > 99 ? "99+" : newCount}
          </span>
        ) : null}
      </Link>
    </nav>
  );
}
