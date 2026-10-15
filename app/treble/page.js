import TrebleHero from "@/components/treble/TrebleHero";
import TrebleLegs from "@/components/treble/TrebleLegs";
import TrebleOverall from "@/components/treble/TrebleOverall";
import TrebleClubGains from "@/components/treble/TrebleClubGains";
import TrebleFans from "@/components/treble/TrebleFans";
import TrebleScoring from "@/components/treble/TrebleScoring";
import TrebleRules from "@/components/treble/TrebleRules";
import TrebleRegister from "@/components/treble/TrebleRegister";
import TrebleFooterLine from "@/components/treble/TrebleFooterLine";
import { TREBLE_META, TREBLE_PATH } from "@/lib/treble";

export const metadata = {
  title: {
    absolute: TREBLE_META.title,
  },
  description: TREBLE_META.description,
  alternates: { canonical: TREBLE_PATH },
  openGraph: {
    title: TREBLE_META.title,
    description: TREBLE_META.description,
    url: TREBLE_PATH,
    images: [
      {
        url: "/og-default.jpg",
        width: 1200,
        height: 630,
        alt: "The Reflective Football. Football is nothing without the fans.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TREBLE_META.title,
    description: TREBLE_META.description,
    images: ["/og-default.jpg"],
  },
};

export default async function TreblePage({ searchParams }) {
  const params = (await searchParams) ?? {};
  const raw = Array.isArray(params.role) ? params.role[0] : params.role;
  const initialRole = raw === "host" ? "host" : "club";

  return (
    <>
      <TrebleHero />
      <TrebleLegs />
      <TrebleOverall />
      <TrebleClubGains />
      <TrebleFans />
      <TrebleScoring />
      <TrebleRules />
      <TrebleRegister initialRole={initialRole} />
      <TrebleFooterLine />
    </>
  );
}
