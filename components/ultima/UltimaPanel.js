import Link from "next/link";
import styles from "./ultima.module.css";

export default function UltimaPanel({
  title,
  actionLabel,
  actionHref,
  action,
  raised = false,
  live = false,
  sample = false,
  id,
  className,
  children,
}) {
  const heading = title || actionLabel || action;
  const cls = [
    raised ? styles.opPanelRaised : styles.opPanel,
    live ? styles.opPanelLive : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={cls} id={id}>
      {heading ? (
        <header className={styles.opPanelHead}>
          {title ? (
            <h2 className={styles.opPanelTitle}>
              {title}
              {sample ? <span className={styles.sampleChip}>SAMPLE</span> : null}
            </h2>
          ) : (
            <span />
          )}
          {action
            ? action
            : actionLabel && actionHref
              ? (
                  <Link href={actionHref} className={styles.opPanelAction}>
                    {actionLabel}
                  </Link>
                )
              : null}
        </header>
      ) : null}
      <div className={styles.opPanelBody}>{children}</div>
    </section>
  );
}
