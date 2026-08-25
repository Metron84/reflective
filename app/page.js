import HomeTree from "@/components/home/HomeTree";
import TrainingRibbon from "@/components/home/TrainingRibbon";
import ReportSection from "@/components/home/ReportSection";
import {
  SITE_DESCRIPTION,
  SITE_URL,
  SOCIAL_LINKS,
  TRAINING_ENABLED,
  getHeroPromoVideoSrc,
} from "@/lib/config";
import { getAuthContext } from "@/lib/auth/session";
import { getHomepageDoorMeta } from "@/lib/homepage-status";
import { REPORT_DOI } from "@/lib/report";

export const metadata = {
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    url: "/",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    description: SITE_DESCRIPTION,
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "The Reflective Football",
      alternateName: "TRF",
      url: SITE_URL,
      logo: `${SITE_URL}/brand/trf-icon-512.png`,
      description: SITE_DESCRIPTION,
      slogan: "Football is nothing without the fans.",
      email: "melo@thereflectivefootball.com",
      sameAs: [
        SOCIAL_LINKS.youtube,
        SOCIAL_LINKS.instagram,
        SOCIAL_LINKS.linkedin,
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "The Reflective Football",
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "en",
    },
    {
      "@type": "Report",
      "@id": `${SITE_URL}/#who-is-football-for`,
      headline:
        "Who Is Football For? Fan Testimony from the 2026 FIFA World Cup",
      name: "Who Is Football For? Fan Testimony from the 2026 FIFA World Cup",
      identifier: REPORT_DOI,
      url: REPORT_DOI,
      datePublished: "2026-07-31",
      author: {
        "@type": "Person",
        name: "Melo Doumani",
      },
      publisher: {
        "@type": "Organization",
        name: "The Reflective Football LLC",
      },
    },
  ],
};

export default async function Home() {
  const { isSignedIn } = await getAuthContext();
  const doorMeta = getHomepageDoorMeta();
  const promoVideoSrc = getHeroPromoVideoSrc();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <HomeTree
        doorMeta={doorMeta}
        promoVideoSrc={promoVideoSrc}
        isSignedIn={isSignedIn}
      />
      {TRAINING_ENABLED ? <TrainingRibbon /> : null}
      <ReportSection />
    </>
  );
}
