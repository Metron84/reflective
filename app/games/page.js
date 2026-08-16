import LiveGameCard from "@/components/games/LiveGameCard";
import ComingSoonGameCard from "@/components/games/ComingSoonGameCard";
import SectionHeader from "@/components/SectionHeader";
import Breadcrumb from "@/components/Breadcrumb";
import { GUESSER_STRAPLINE } from "@/lib/config";
import { getGames } from "@/lib/games";
import styles from "./page.module.css";

export const metadata = {
  title: "Games",
  description:
    "Ultima, Codemaster, and The Guesser. Play from The Reflective Football.",
  alternates: { canonical: "/games" },
};

export default function GamesPage() {
  const games = getGames();
  const liveGames = games.filter((game) => game.status === "live");
  const comingSoon = games.filter((game) => game.status !== "live");

  return (
    <div className={styles.page}>
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Games" }]} />
      <div className={styles.inner}>
        <SectionHeader
          eyebrow="Games. For the Fun."
          title="Games"
          className={styles.sectionHeader}
        />

        {liveGames.length > 0 ? (
          <section className={styles.heroSection} aria-label="Live games">
            <ul className={styles.comingGrid}>
              {liveGames.map((game) => (
                <li key={game.slug}>
                  <LiveGameCard
                    game={game}
                    strapline={
                      game.slug === "the-guesser" ? GUESSER_STRAPLINE : null
                    }
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {comingSoon.length > 0 ? (
          <section className={styles.comingSection} aria-labelledby="more-games-heading">
            <h2 id="more-games-heading" className={styles.comingHeading}>
              More games coming
            </h2>
            <ul className={styles.comingGrid}>
              {comingSoon.map((game) => (
                <li key={game.slug}>
                  <ComingSoonGameCard game={game} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
