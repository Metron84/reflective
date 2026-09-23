import Link from "next/link";
import UltimaInboxItem from "./UltimaInboxItem";
import styles from "./ultima.module.css";

export default function UltimaStaffMessage({
  subject = "A note from the staff",
  body,
  actionLabel,
  onAction,
  href,
}) {
  return (
    <div className={styles.opStaff} role="status">
      <UltimaInboxItem type="staff" subject={subject} sender={body} />
      {actionLabel && href && !onAction ? (
        <Link href={href} className={styles.opStaffAction}>
          {actionLabel}
        </Link>
      ) : null}
      {actionLabel && onAction ? (
        <button type="button" className={styles.opStaffAction} onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
