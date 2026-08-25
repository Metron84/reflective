import styles from "./TrainingStanding.module.css";

const QUOTES = [
  {
    club: "Dubai Hammers",
    role: "Official supporters club",
    quote:
      "Very well produced. I think you guys are providing a great insight into the supporters clubs out here. Well done.",
  },
  {
    club: "Chelsea UAE",
    role: "Official supporters club",
    quote: "Absolutely love this.",
  },
  {
    club: "Dubai Lions",
    role: "Official supporters club",
    quote: "We love what you're doing. Seriously, keep it up.",
  },
];

export default function TrainingStanding() {
  return (
    <section
      className={styles.section}
      aria-labelledby="training-standing-title"
    >
      <div className={styles.inner}>
        <p className={styles.eyebrow}>What the clubs say</p>
        <h2 id="training-standing-title" className={styles.heading}>
          The access is the proof.
        </h2>

        <div className={styles.quotes} aria-label="Club testimonials">
          {QUOTES.map((item) => (
            <article key={item.club} className={styles.block}>
              <div className={styles.rule} aria-hidden="true" />
              <p className={styles.character}>
                {item.club} — {item.role}
              </p>
              <blockquote className={styles.quote}>
                <p className={styles.quoteText}>{item.quote}</p>
              </blockquote>
            </article>
          ))}
        </div>

        <div className={styles.footer}>
          <p className={styles.footerLine}>
            Three official supporters clubs with links to the UK have all asked
            us back.
          </p>
          <div className={styles.footerUnderline} aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
