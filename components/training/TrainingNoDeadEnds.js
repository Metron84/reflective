import Link from "next/link";
import styles from "./TrainingNoDeadEnds.module.css";

const LINKS = [
  { href: "/films", label: "Watch the films" },
  { href: "/concierge", label: "Ask the Concierge" },
  { href: "/games", label: "Play the games" },
];

export default function TrainingNoDeadEnds() {
  return (
    <section
      className={styles.section}
      aria-labelledby="training-continue-title"
    >
      <div className={styles.inner}>
        <h2 id="training-continue-title" className={styles.heading}>
          While you are here
        </h2>
        <nav className={styles.links} aria-label="Continue on the site">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={styles.link}>
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </section>
  );
}
