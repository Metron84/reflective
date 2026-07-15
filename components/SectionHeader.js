import styles from "./SectionHeader.module.css";

export default function SectionHeader({
  eyebrow,
  title,
  context,
  variant = "cream",
  className = "",
}) {
  return (
    <header
      data-section-header=""
      className={`${styles.header} ${styles[variant]} ${className}`.trim()}
    >
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h1 className={styles.title}>{title}</h1>
      {context ? <p className={styles.context}>{context}</p> : null}
    </header>
  );
}
