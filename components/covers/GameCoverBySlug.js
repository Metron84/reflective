import GuesserBoardCover from "./GuesserBoardCover";
import FantasyManagerCover from "./FantasyManagerCover";
import YouDecideCover from "./YouDecideCover";

export default function GameCoverBySlug({ slug, compact = false }) {
  switch (slug) {
    case "the-guesser":
      return <GuesserBoardCover compact={compact} />;
    case "ultimate-fantasy-manager":
      return <FantasyManagerCover />;
    case "you-decide":
      return <YouDecideCover />;
    default:
      return <GuesserBoardCover compact={compact} />;
  }
}
