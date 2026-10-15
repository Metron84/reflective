import HubPage from "@/components/hub/HubPage";
import { KOTB_ENABLED } from "@/lib/config";
import { KOTB_PATH } from "@/lib/kotb";
import { TREBLE_CARD } from "@/lib/treble";

export const metadata = {
  title: "Competitions",
  description:
    "The Reflectives, King of the Burgers, and The Treble. Competitions run by and for football fans.",
  alternates: { canonical: "/competitions" },
};

export default function CompetitionsPage() {
  const cards = [
    {
      slug: "reflectives",
      title: "The Reflectives",
      hook: "Eight awards for the fans of the summer. Sign up free to vote.",
      href: "/reflections",
      cover: "/home/doors/competitions-mario.jpg",
      coverFocus: "38% 40%",
      statusLabel: null,
    },
    ...(KOTB_ENABLED
      ? [
          {
            slug: "king-of-the-burgers",
            title: "King of the Burgers",
            hook: "Eight Dubai burgers. Two supporters clubs judge each one.",
            href: KOTB_PATH,
            cover: "/king-of-the-burgers/kotb-card.svg",
            statusLabel: "Applications open",
          },
        ]
      : []),
    TREBLE_CARD,
  ];

  return (
    <HubPage
      crumb="Competitions"
      eyebrow="Competitions. For the Fans."
      title="Competitions"
      cards={cards}
      action="Enter"
      wide
      next={{ href: "/events", eyebrow: "Events", title: "See the events" }}
    />
  );
}
