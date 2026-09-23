import Link from "next/link";
import styles from "./ultima.module.css";

function ScoutIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill="currentColor"
        d="M10.2 4.4a5.8 5.8 0 1 1 0 11.6 5.8 5.8 0 0 1 0-11.6Zm0 1.8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm6.6 8.2 4.6 4.6-1.3 1.3-4.6-4.6 1.3-1.3Z"
      />
    </svg>
  );
}

function TradeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill="currentColor"
        d="M7.2 6.4h6.4l-1.6-1.6L13.4 3.4 20 9l-6.6 5.6-1.4-1.4 1.6-1.6H7.2V6.4Zm9.6 11.2H10.4l1.6 1.6-1.4 1.4L4 15l6.6-5.6 1.4 1.4-1.6 1.6h6.4v5.2Z"
      />
    </svg>
  );
}

function BoardIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill="currentColor"
        d="M5 5.2h2.2V7H5V5.2Zm4.2 0H19V7H9.2V5.2ZM5 10.4h2.2v1.8H5v-1.8Zm4.2 0H19v1.8H9.2v-1.8ZM5 15.6h2.2V17.4H5v-1.8Zm4.2 0H19v1.8H9.2v-1.8Z"
      />
    </svg>
  );
}

function LeagueIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill="currentColor"
        d="M12 3.2 13.8 8h5.2l-4.2 3.2 1.6 5.2L12 13.8 7.6 16.4l1.6-5.2L5 8h5.2L12 3.2Z"
      />
    </svg>
  );
}

function StaffIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill="currentColor"
        d="M12 12.4a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8Zm-6.8 7.2c.4-3.2 3.4-5.2 6.8-5.2s6.4 2 6.8 5.2H5.2Z"
      />
    </svg>
  );
}

const ICONS = {
  scout: ScoutIcon,
  trade: TradeIcon,
  board: BoardIcon,
  league: LeagueIcon,
  staff: StaffIcon,
};

export default function UltimaInboxItem({
  type = "staff",
  unread = false,
  subject,
  sender,
  time,
  href,
  onClick,
}) {
  const Icon = ICONS[type] ?? StaffIcon;
  const read = !unread;
  const className = `${styles.opInbox} ${onClick ? styles.opInboxButton : ""} ${read ? styles.opInboxRead : ""}`.trim();
  const meta = [sender, time].filter(Boolean).join(" · ");
  const inner = (
    <>
      <span className={styles.opInboxIcon}>
        <Icon />
      </span>
      <span className={styles.opInboxCopy}>
        <p className={styles.opInboxSubject}>
          {unread ? <span className={styles.opInboxDot} aria-hidden /> : null}
          {subject}
        </p>
        {meta ? <p className={styles.opInboxMeta}>{meta}</p> : null}
      </span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {inner}
      </button>
    );
  }

  return <div className={className}>{inner}</div>;
}
