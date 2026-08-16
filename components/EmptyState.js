import Link from "next/link";
import styles from "./empty-state.module.css";

/**
 * Shared empty / not-enough-data surface.
 * heading, one line, then a spaced action (min 24px gap).
 */
export default function EmptyState({
  heading,
  body,
  actionLabel,
  actionHref,
  onAction,
  tone = "cream",
}) {
  const actionClass = tone === "navy" ? styles.actionNavy : styles.action;

  return (
    <div className={tone === "navy" ? styles.wrapNavy : styles.wrap}>
      {heading ? <h2 className={styles.heading}>{heading}</h2> : null}
      {body ? <p className={styles.body}>{body}</p> : null}
      {actionHref ? (
        <Link href={actionHref} className={actionClass}>
          {actionLabel}
        </Link>
      ) : null}
      {!actionHref && onAction && actionLabel ? (
        <button type="button" className={actionClass} onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
