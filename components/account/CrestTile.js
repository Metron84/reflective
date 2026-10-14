import { Tile } from "./GamesSection";

/**
 * @param {{crest: {clubName: string, roomPct: number}|null}} props
 */
export default function CrestTile({ crest }) {
  return (
    <Tile
      id="crest-tile"
      name="The Crest"
      played={Boolean(crest)}
      quiet="Eighteen swipes. One club that sounds like you."
      href="/crest"
      cta="Swipe again"
      stats={
        crest
          ? [
              ["Your club", crest.clubName],
              ["Room", `${crest.roomPct}%`],
            ]
          : null
      }
    />
  );
}
