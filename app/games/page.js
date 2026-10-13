import HubPage from "@/components/hub/HubPage";
import ComingSoonGameCard from "@/components/games/ComingSoonGameCard";
import { GUESSER_STRAPLINE } from "@/lib/config";
import { getGames } from "@/lib/games";
import styles from "./page.module.css";

export const metadata = {
  title: "Games",
  description:
    "Ultima, The Crest, Codemaster, and The Guesser. Play from The Reflective Football.",
  alternates: { canonical: "/games" },
};

// King of the Burgers lives on /competitions only.
const COMPETITION_SLUGS = new Set(["king-of-the-burgers"]);

export default function GamesPage() {
  const games = getGames().filter((game) => !COMPETITION_SLUGS.has(game.slug));
  const liveGames = games
    .filter((game) => game.status === "live")
    .map((game) => ({
      ...game,
      strapline: game.slug === "the-guesser" ? GUESSER_STRAPLINE : null,
    }));
  const comingSoon = games.filter((game) => game.status !== "live");

  return (
    <HubPage
      crumb="Games"
      eyebrow="Games. For the Fans."
      title="Games"
      cards={liveGames}
      next={{ href: "/competitions", eyebrow: "Competitions", title: "See the competitions" }}
    >
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
    </HubPage>
  );
}
