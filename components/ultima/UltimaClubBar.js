import Link from "next/link";
import styles from "./ultima.module.css";

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <path
        fill="currentColor"
        d="M12 3.2a5.4 5.4 0 0 0-5.4 5.4v3.1L4.9 15v1.6h14.2V15l-1.7-3.3V8.6A5.4 5.4 0 0 0 12 3.2Zm-1.9 15.2a1.9 1.9 0 0 0 3.8 0h-3.8Z"
      />
    </svg>
  );
}

export default function UltimaClubBar({
  teamName,
  seasonLine,
  continueAction,
  sample = false,
  unread = null,
}) {
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
      <div className={styles.clubBarActions}>
        {unread == null ? null : (
          <Link
            prefetch={false}
            href="/ultima/inbox"
            className={styles.bell}
            aria-label={unread > 0 ? `Inbox, ${unread} unread` : "Inbox"}
          >
            <BellIcon />
            {unread > 0 ? (
              <span className={styles.bellCount}>{unread > 99 ? "99+" : unread}</span>
            ) : null}
          </Link>
        )}
        <Link prefetch={false} href={action.href} className={styles.continueBtn}>
          {action.label}
        </Link>
      </div>
    </header>
  );
}
