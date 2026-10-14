import Link from "next/link";
import styles from "./AdminBlock.module.css";

/** Admin links. The page renders this only when profiles.is_admin is true. */
export default function AdminBlock() {
  return (
    <section className={styles.block} aria-label="Admin">
      <h2 className={styles.title}>Admin</h2>
      <ul className={styles.links}>
        <li>
          <Link href="/admin/tagging">Tagging admin</Link>
        </li>
        <li>
          <Link href="/admin/observatory">Observatory</Link>
        </li>
      </ul>
    </section>
  );
}
