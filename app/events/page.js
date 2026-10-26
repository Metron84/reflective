import HubPage from "@/components/hub/HubPage";
import { CLOCKEND_PUBLIC, FATF_ENABLED } from "@/lib/config";
import { FATF_PATH } from "@/lib/fatf";
import { TREBLE_CARD } from "@/lib/treble";

export const metadata = {
  title: "Events",
  description:
    "For All The Fans nights, and the Concierge for finding where your club watches in Dubai.",
  alternates: { canonical: "/events" },
};

export default function EventsPage() {
  const cards = [
    TREBLE_CARD,
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
    ...(CLOCKEND_PUBLIC
      ? [
          {
            slug: "clockend",
            title: "Clock End Dubai",
            hook: "Bring the noise. Keep your seat.",
            href: "/clockend",
            cover: "/clockend/hero.jpg",
            coverFocus: "30% 30%",
            statusLabel: null,
          },
        ]
      : []),
    {
      slug: "concierge",
      title: "Concierge",
      hook: "Find where your club watches in Dubai.",
      href: "/concierge",
      cover: "/home/doors/events-arsenal.jpg",
      coverFocus: "48% 45%",
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
      wide
      next={{ href: "/observatory", eyebrow: "Observatory", title: "Study the fans" }}
    />
  );
}
