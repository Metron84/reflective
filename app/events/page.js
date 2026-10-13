import HubPage from "@/components/hub/HubPage";
import { FATF_ENABLED } from "@/lib/config";
import { FATF_PATH } from "@/lib/fatf";

export const metadata = {
  title: "Events",
  description:
    "For All The Fans nights, and the Concierge for finding where your club watches in Dubai.",
  alternates: { canonical: "/events" },
};

export default function EventsPage() {
  const cards = [
    ...(FATF_ENABLED
      ? [
          {
            slug: "for-all-the-fans",
            title: "For All The Fans",
            hook: "One night a month, the room goes to the people who work every matchday.",
            href: FATF_PATH,
            cover: "/fatf/hero.jpg",
            statusLabel: null,
          },
        ]
      : []),
    {
      slug: "concierge",
      title: "Concierge",
      hook: "Find where your club watches in Dubai.",
      href: "/concierge",
      cover: "/brand/films-hero-bg.jpg",
      statusLabel: null,
    },
  ];

  return (
    <HubPage
      crumb="Events"
      eyebrow="Events. For the Fans."
      title="Events"
      cards={cards}
      action="Open"
      next={{ href: "/observatory", eyebrow: "Observatory", title: "Study the fans" }}
    />
  );
}
