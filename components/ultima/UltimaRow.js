import Link from "next/link";
import styles from "./ultima.module.css";

export default function UltimaRow({
  primary,
  meta,
  number,
  yours = false,
  href,
  onClick,
  className,
  children,
}) {
  const cls = [yours ? styles.opRowYours : styles.opRow, className]
    .filter(Boolean)
    .join(" ");
  const inner = (
    <>
      <div className={styles.opRowCopy}>
        {primary ? <p className={styles.opRowPrimary}>{primary}</p> : null}
        {meta ? <p className={styles.opRowMeta}>{meta}</p> : null}
        {children}
      </div>
      {number != null && number !== "" ? (
        <div className={styles.opRowNumber}>{number}</div>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick}>
        {inner}
      </button>
    );
  }

  return <div className={cls}>{inner}</div>;
}
