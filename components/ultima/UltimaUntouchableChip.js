import styles from "./ultima.module.css";

/** Muted chip for a player the owner will not trade. */
export default function UltimaUntouchableChip() {
  return <span className={styles.untouchChip}>Untouchable</span>;
}
