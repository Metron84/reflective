import InterestForm from "@/components/laliga/InterestForm";
import LaligaFilms from "@/components/laliga/LaligaFilms";
import styles from "./page.module.css";

export const metadata = {
  title: "LaLiga Nights Dubai",
  description:
    "Tell us your club. We are building LaLiga Nights in Dubai.",
  // Remove noindex once the campaign is live.
  robots: { index: false },
};

const PROOF = [
  "16,000+ views on our Spanish film",
  "Spain is our third largest audience",
  "AED 0 spent on promotion",
];

export default function LaligaPage() {
  return (
    <>
      <section className={styles.hero} aria-labelledby="laliga-headline">
        <div className={styles.inner}>
          <p className={styles.eyebrow}>LALIGA NIGHTS · DUBÁI</p>
          <h1 id="laliga-headline" className={styles.headline} lang="es">
            ¿A quién apoyas?
          </h1>
          <p className={styles.standfirst}>
            Tell us your club. We are building LaLiga Nights in Dubai.
          </p>
          <hr className={styles.rule} />
          <ul className={styles.chips}>
            {PROOF.map((line) => (
              <li key={line} className={styles.chip}>
                {line}
              </li>
            ))}
          </ul>
          <p className={styles.note} lang="es">
            MC en español. Fiesta antes del partido. Debate al final. Todo en
            español.
          </p>
        </div>
      </section>

      <section className={styles.interest} aria-label="LaLiga Nights interest">
        <div className={styles.interestInner}>
          <InterestForm />
        </div>
      </section>

      <LaligaFilms />
    </>
  );
}
