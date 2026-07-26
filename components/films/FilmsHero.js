import Image from "next/image";
import Link from "next/link";
import { FILMS_HERO_PICKS_ID } from "@/lib/films/hero";
import { formatNumber } from "@/lib/stats/format";
import styles from "./FilmsHero.module.css";

const CHIPS = [
  "May 1st",
  "Ages 20–65",
  "UK · UAE · USA · Spain",
  "AED 0",
];

/**
 * Films page hero v2 — crest + ambient bg, YouTube proof plaque, context chips.
 * Scotland facade lives only in FilmsHeroPicks.
 */
export default function FilmsHero({ youtubeViews, watchHours }) {
  return (
    <section className={styles.hero} aria-labelledby="films-hero-title">
      <div className={styles.bg} aria-hidden>
        <Image
          src="/brand/films-hero-bg.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className={styles.bgImage}
        />
        <div className={styles.bgVeil} />
      </div>

      <div className={styles.inner}>
        <div className={styles.crestWrap}>
          <Image
            src="/brand/films-hero-crest.jpg"
            alt="The Reflective Football"
            width={160}
            height={162}
            priority
            className={styles.crest}
          />
        </div>

        <h1 id="films-hero-title" className={styles.headline}>
          We connect the football fan community
        </h1>

        <div className={styles.plaque} aria-label="YouTube performance">
          <p className={styles.plaqueEyebrow}>YouTube</p>
          <div className={styles.plaqueStats}>
            <div className={styles.plaqueStat}>
              <p className={styles.plaqueNumber}>
                {formatNumber(youtubeViews ?? 0)}
              </p>
              <p className={styles.plaqueLabel}>views</p>
            </div>
            <div className={styles.plaqueDivider} aria-hidden />
            <div className={styles.plaqueStat}>
              <p className={styles.plaqueNumber}>
                {formatNumber(watchHours ?? 0)}
              </p>
              <p className={styles.plaqueLabel}>hours</p>
            </div>
          </div>
        </div>

        <ul className={styles.chips}>
          {CHIPS.map((chip) => (
            <li key={chip} className={styles.chip}>
              {chip}
            </li>
          ))}
        </ul>

        <Link href={`#${FILMS_HERO_PICKS_ID}`} className={styles.cta}>
          Watch the films
        </Link>
      </div>
    </section>
  );
}
