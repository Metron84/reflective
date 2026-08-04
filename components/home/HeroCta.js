import Link from "next/link";
import { HERO_CTA } from "@/lib/hero-cta";
import styles from "./HeroCta.module.css";

export default function HeroCta() {
  return (
    <Link href={HERO_CTA.href} className={styles.ribbon}>
      <span className={styles.lineShort}>{HERO_CTA.lineShort}</span>
      <span className={styles.lineFull}>{HERO_CTA.line}</span>
      <span className={styles.arrow} aria-hidden="true">
        →
      </span>
    </Link>
  );
}
