/**
 * TEMP DEV SCAFFOLDING — delete in Section 6.
 * Fan Card visual preview only. Not linked from StandBoard.
 * Reachable while The Stand is parked; always noindex.
 */
import FanCard from "@/components/stand/FanCard";
import { buildCardState } from "@/lib/stand/card";
import { getStandChapter } from "@/lib/stand";
import styles from "./page.module.css";

export const metadata = {
  title: "Fan Card preview (dev)",
  robots: { index: false, follow: false },
};

function withLabels(card) {
  return {
    ...card,
    badgeLabels: {
      club: "Fiorentina",
      nation: "Italy",
      player: "Thierry Henry",
    },
  };
}

function fixtureFiorentinaMid() {
  const chapter = getStandChapter("sa.acf-fiorentina.ch01");
  const progress = {
    badges: {
      clubId: "acf-fiorentina",
      nationId: "nation-italy",
      personId: "thierry-henry",
    },
    activeBadge: "club",
    chapterId: "sa.acf-fiorentina.ch01",
    answers: {
      1: "A",
      2: "A",
      3: "A",
      4: "C",
      5: "A",
      6: "C",
      7: "A",
    },
    nextOrder: 8,
    dayUsage: { "2026-07-22": 5, "2026-07-23": 2 },
    onboardingDone: true,
  };
  const card = buildCardState(progress, (id) =>
    id === chapter?.id ? chapter : getStandChapter(id),
  );
  return withLabels({
    ...card,
    pulse: "You stand with 23% of the Viola",
  });
}

function fixtureItalyComplete() {
  const chapter = getStandChapter("na.italy.ch01");
  const answers = {};
  for (let i = 1; i <= 15; i += 1) {
    const q = chapter.questions.find((x) => x.order === i);
    answers[String(i)] = q?.choices?.[0]?.id ?? "A";
  }
  const progress = {
    badges: {
      clubId: "acf-fiorentina",
      nationId: "nation-italy",
      personId: "thierry-henry",
    },
    activeBadge: "nation",
    chapterId: "na.italy.ch01",
    answers,
    nextOrder: 16,
    dayUsage: {
      "2026-07-20": 5,
      "2026-07-21": 5,
      "2026-07-22": 5,
    },
    onboardingDone: true,
  };
  return withLabels(
    buildCardState(progress, (id) =>
      id === chapter?.id ? chapter : getStandChapter(id),
    ),
  );
}

function fixtureHenryFresh() {
  const progress = {
    badges: {
      clubId: "acf-fiorentina",
      nationId: "nation-italy",
      personId: "thierry-henry",
    },
    activeBadge: "player",
    chapterId: "player.thierry-henry.ch01",
    answers: {},
    nextOrder: 1,
    dayUsage: {},
    onboardingDone: true,
  };
  return withLabels(buildCardState(progress, getStandChapter));
}

export default function StandCardPreviewPage() {
  const fiorentina = fixtureFiorentinaMid();
  const italy = fixtureItalyComplete();
  const henry = fixtureHenryFresh();

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>DEV ONLY · DELETE IN SECTION 6</p>
          <h1 className={styles.heading}>Fan Card preview</h1>
          <p className={styles.lede}>
            Three fixtures full, plus one compact. Not wired to StandBoard.
          </p>
        </header>

        <section className={styles.section} aria-labelledby="fix-1">
          <h2 id="fix-1" className={styles.sectionTitle}>
            1. Fiorentina club · mid-chapter
          </h2>
          <FanCard cardState={fiorentina} variant="full" />
        </section>

        <section className={styles.section} aria-labelledby="fix-2">
          <h2 id="fix-2" className={styles.sectionTitle}>
            2. Italy nation · chapter complete
          </h2>
          <FanCard cardState={italy} variant="full" />
        </section>

        <section className={styles.section} aria-labelledby="fix-3">
          <h2 id="fix-3" className={styles.sectionTitle}>
            3. Thierry Henry player · fresh
          </h2>
          <FanCard cardState={henry} variant="full" />
        </section>

        <section className={styles.section} aria-labelledby="fix-4">
          <h2 id="fix-4" className={styles.sectionTitle}>
            4. Compact (Fiorentina)
          </h2>
          <FanCard cardState={fiorentina} variant="compact" />
        </section>
      </div>
    </main>
  );
}
