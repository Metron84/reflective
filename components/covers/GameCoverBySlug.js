import GuesserBoardCover from "./GuesserBoardCover";
import FantasyManagerCover from "./FantasyManagerCover";
import YouDecideCover from "./YouDecideCover";
import StandCover from "./StandCover";

export default function GameCoverBySlug({ slug, compact = false }) {
  switch (slug) {
    case "the-guesser":
      return (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src="/games/the-guesser.svg"
          alt=""
          style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
        />
      );
    case "the-stand":
      return <StandCover compact={compact} />;
    case "ultima":
    case "ultimate-fantasy-manager":
      return <FantasyManagerCover />;
    case "you-decide":
      return <YouDecideCover />;
    default:
      return <GuesserBoardCover compact={compact} />;
  }
}
