import HubPage from "@/components/hub/HubPage";
import { KOTB_ENABLED } from "@/lib/config";
import { KOTB_PATH } from "@/lib/kotb";

export const metadata = {
  title: "Competitions",
  description:
    "The Reflectives and King of the Burgers. Competitions run by and for football fans.",
  alternates: { canonical: "/competitions" },
};

export default function CompetitionsPage() {
  const cards = [
    {
      slug: "reflectives",
      title: "The Reflectives",
      hook: "Eight awards for the fans of the summer. Sign up free to vote.",
      href: "/reflections",
      cover: "/reflections/hero-still.jpg",
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
  ];

  return (
    <HubPage
      crumb="Competitions"
      eyebrow="Competitions. For the Fans."
      title="Competitions"
      cards={cards}
      action="Enter"
      next={{ href: "/events", eyebrow: "Events", title: "See the events" }}
    />
  );
}
