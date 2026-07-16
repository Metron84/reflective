import GuesserHeroCard from "@/components/games/GuesserHeroCard";
import ComingSoonGameCard from "@/components/games/ComingSoonGameCard";
import SectionHeader from "@/components/SectionHeader";
import { GUESSER_STRAPLINE } from "@/lib/config";
import { getGames } from "@/lib/games";
import styles from "./page.module.css";

export const metadata = {
  title: "Games",
  description: "Play The Guesser and discover what is next from The Reflective Football.",
};

export default function GamesPage() {
  const games = getGames();
  const liveGame = games.find((game) => game.status === "live");
  const comingSoon = games.filter((game) => game.status !== "live");

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <SectionHeader
          eyebrow="Games. For the Fun."
          title="Games"
          className={styles.sectionHeader}
        />

        {liveGame ? (
          <section className={styles.heroSection} aria-label="The Guesser">
            <p className={styles.guesserContext}>{GUESSER_STRAPLINE}</p>
            <GuesserHeroCard game={liveGame} />
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
