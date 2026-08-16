import Link from "next/link";
import styles from "./breadcrumb.module.css";

/**
 * Shared wayfinding bar. Ancestor segments link; the current segment does not.
 * items: [{ label, href? }] — last item is current (no href).
 */
export default function Breadcrumb({ items = [], tone = "cream" }) {
  if (!items.length) return null;

  return (
    <nav
      className={tone === "navy" ? styles.barNavy : styles.bar}
      aria-label="Breadcrumb"
    >
      <ol className={styles.list}>
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className={styles.item}>
              {index > 0 ? (
                <span className={styles.sep} aria-hidden>
                  /
                </span>
              ) : null}
              {last || !item.href ? (
                <span className={styles.current} aria-current="page">
                  {item.label}
                </span>
              ) : (
                <Link href={item.href} className={styles.link}>
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
