import HomeTree from "@/components/home/HomeTree";
import { getVotingState, SITE_URL, SOCIAL_LINKS } from "@/lib/config";
import { getAuthContext } from "@/lib/auth/session";

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "The Reflective Football",
      url: SITE_URL,
      logo: `${SITE_URL}/brand/trf-icon-512.png`,
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
      description:
        "Fan-first football films from Dubai. Football is nothing without the fans.",
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "en",
    },
  ],
};

export default async function Home() {
  const { isSignedIn } = await getAuthContext();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <HomeTree
        showVotingDate={getVotingState() === "open"}
        isSignedIn={isSignedIn}
      />
    </>
  );
}
