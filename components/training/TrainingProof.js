import PlayableLoopVideo from "@/components/media/PlayableLoopVideo";
import {
  ClockIcon,
  EyeIcon,
  GlobeIcon,
  PlayIcon,
} from "@/components/training/icons";
import styles from "./TrainingProof.module.css";

const STATS = [
  {
    value: "1M+",
    label: "Impressions across YouTube and Instagram in four months",
    Icon: EyeIcon,
  },
  { value: "107,000+", label: "Views", Icon: PlayIcon },
  {
    value: "1,696",
    label: "Hours watched, which is 70 straight days",
    Icon: ClockIcon,
  },
  {
    value: "80%+",
    label: "Of recent reel views from people who do not follow us",
    Icon: GlobeIcon,
  },
];

const CASE_LINES = [
  "Two reels, published this week.",
  "Over 4,600 views and over 3,000 unique viewers.",
  "Over 80% of those viewers do not follow us.",
  "One club, one venue, two films, no paid promotion.",
];

/** Chelsea Supporters Club UAE reel at /public/chelsea-case-study.mp4 (4:5). */
const CHELSEA_CASE_STUDY_SRC = "/chelsea-case-study.mp4?v=2";

export default function TrainingProof() {
  return (
    <section className={styles.section} aria-labelledby="training-proof-title">
      <div className={styles.inner}>
        <p className={styles.eyebrow}>The proof</p>
        <h2 id="training-proof-title" className={styles.heading}>
          You are learning from a channel that works.
        </h2>

        <dl className={styles.stats}>
          {STATS.map((stat) => {
            const Icon = stat.Icon;
            return (
              <div key={stat.value} className={styles.stat}>
                <Icon className={styles.statIcon} size={20} />
                <dt className={styles.statValue}>{stat.value}</dt>
                <dd className={styles.statLabel}>{stat.label}</dd>
              </div>
            );
          })}
        </dl>

        <p className={styles.reach}>
          Viewers in over 8 countries: UK 20%, UAE 14%, Spain 13%, US 8%, Mexico
          3%. AED 0 spent on promotion.
        </p>

        <blockquote className={styles.quote}>
          <p className={styles.quoteText}>
            In four months nobody has objected to being filmed. At a time when
            people trust almost nothing, they hand me their stories and their
            match reactions. That trust is the actual skill, and it is what I
            teach.
          </p>
          <footer className={styles.attribution}>Melo Doumani, founder</footer>
        </blockquote>

        <div className={styles.caseStudy}>
          <p className={styles.caseLabel}>Case study, Chelsea Supporters Club UAE</p>
          <div className={styles.caseBody}>
            <figure className={styles.caseFilm}>
              <PlayableLoopVideo
                src={CHELSEA_CASE_STUDY_SRC}
                label="Chelsea Supporters Club UAE reel"
                variant="case"
                preload="auto"
                preferAutoplay={false}
                startWithSound
              />
              <figcaption className={styles.caption}>A film we made</figcaption>
            </figure>
            <ul className={styles.caseList}>
              {CASE_LINES.map((line) => (
                <li key={line}>{line}</li>
              ))}
              <li className={styles.casePayoff}>
                This is what one shoot produces. On the course you run a shoot
                like this yourself.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
