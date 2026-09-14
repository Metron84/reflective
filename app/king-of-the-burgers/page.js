import { notFound } from "next/navigation";
import ApplyForm from "@/components/kotb/ApplyForm";
import Bracket from "@/components/kotb/Bracket";
import KotbFilms from "@/components/kotb/KotbFilms";
import { KOTB_ENABLED } from "@/lib/config";
import { KOTB_PATH, SCORING } from "@/lib/kotb";
import styles from "./page.module.css";

const TITLE = "King of the Burgers | The Reflective Football";
const DESCRIPTION =
  "Eight Dubai burgers. Two supporters clubs judge each one. The winner goes through.";

export const metadata = {
  title: {
    absolute: TITLE,
  },
  description: DESCRIPTION,
  alternates: { canonical: KOTB_PATH },
  robots: { index: false, follow: false },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: KOTB_PATH,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function KingOfTheBurgersPage() {
  if (!KOTB_ENABLED) {
    notFound();
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero} aria-labelledby="kotb-title">
        <div className={styles.heroInner}>
          <p className={styles.eyebrow}>EIGHT BURGERS · ONE CROWN</p>
          <h1 id="kotb-title" className={styles.title}>
            KING OF THE BURGERS
          </h1>
          <p className={styles.heroLine}>
            Two rival supporters clubs judge the same burger. The winner goes
            through.
          </p>
          <a href="#apply" className={styles.cta}>
            Apply free
          </a>
        </div>
      </section>

      <section className={styles.block} aria-labelledby="kotb-how">
        <div className={styles.inner}>
          <h2 id="kotb-how" className={styles.h2}>
            How it works
          </h2>
          <ol className={styles.steps}>
            <li>
              <span className={styles.stepNum} aria-hidden="true">
                1
              </span>
              <p>A venue enters one burger. Entry is free.</p>
            </li>
            <li>
              <span className={styles.stepNum} aria-hidden="true">
                2
              </span>
              <p>Two rival supporters clubs eat the same burger and score it.</p>
            </li>
            <li>
              <span className={styles.stepNum} aria-hidden="true">
                3
              </span>
              <p>The higher total goes through.</p>
            </li>
          </ol>
        </div>
      </section>

      <section className={styles.block} aria-labelledby="kotb-score">
        <div className={styles.inner}>
          <h2 id="kotb-score" className={styles.h2}>
            How it is scored
          </h2>
          <p className={styles.scoreLead}>
            Each measure is worth 2. A panel scores out of 10. A venue totals
            out of 20.
          </p>
          <ul className={styles.measures}>
            {SCORING.map((measure) => (
              <li key={measure.key}>
                <p className={styles.measureLabel}>{measure.label}</p>
                <p className={styles.measureBody}>{measure.description}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className={styles.bracketBand}>
        <div className={styles.bracketInner}>
          <Bracket />
        </div>
      </div>

      <section id="apply" className={styles.apply} aria-labelledby="kotb-apply">
        <div className={styles.inner}>
          <p className={styles.applyEyebrow}>ENTRY IS FREE</p>
          <h2 id="kotb-apply" className={styles.applyTitle}>
            Enter your burger
          </h2>
          <p className={styles.applyLead}>
            Nothing purchased affects a result. The vote is public.
          </p>
          <ApplyForm />
        </div>
      </section>

      <KotbFilms />
    </main>
  );
}
