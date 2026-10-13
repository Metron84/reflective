import HubPage from "@/components/hub/HubPage";
import { OBSERVATORY_ENABLED, SITE_URL } from "@/lib/config";
import { REPORT_DOI } from "@/lib/report";

export const metadata = {
  title: "The Observatory",
  description: "Where TRF studies football fans. Open studies you can take part in, and the reports that come out of them.",
  alternates: { canonical: `${SITE_URL}/observatory` },
  robots: OBSERVATORY_ENABLED ? { index: true, follow: true } : { index: false, follow: false },
};

export default function ObservatoryPage() {
  const cards = [
    {
      slug: "footballer-001",
      title: "What should a footballer be?",
      hook: "Ten questions. Two minutes. Anonymous.",
      href: "/observatory/footballer-001",
      cover: "/home/doors/observatory-chelsea.jpg",
      coverFocus: "55% 50%",
      statusLabel: "OPEN",
      action: "Take part",
    },
    {
      slug: "library",
      title: "Library",
      hook: "Read, watch and listen. Where to start with every work in the archive.",
      href: "/archive",
      cover: "/brand/films-hero-bg.jpg",
      action: "Browse",
    },
    {
      slug: "fan-interview-report",
      title: "The fan interview report",
      hook: "Around 400 fan interviews from May 2026 to the World Cup final.",
      href: REPORT_DOI,
      cover: "/home/hero.jpg",
      action: "Read",
    },
  ];

  return (
    <HubPage
      crumb="Observatory"
      eyebrow="Observatory. For the Fans."
      title="Observatory"
      context="Where TRF studies football fans. Open studies you can take part in, and the reports that come out of them."
      cards={cards}
      wide
      next={{ href: "/games", eyebrow: "Games", title: "Play a game" }}
    />
  );
}
