import Link from "next/link";
import styles from "./SectionContinue.module.css";

export default function SectionContinue({
  nextHref,
  nextEyebrow,
  nextTitle,
  homeHref = "/",
}) {
  return (
    <section className={styles.section} aria-label="Continue">
      <p className={styles.lead}>
        Next:{" "}
        <span className={styles.leadAccent}>
          {nextEyebrow.replace(/\.\s*$/, "")}.
        </span>
      </p>
      <div className={styles.actions}>
        <Link href={nextHref} className={styles.primary}>
          {nextTitle}
        </Link>
        <Link href={homeHref} className={styles.secondary}>
          Return home
        </Link>
      </div>
    </section>
  );
}
