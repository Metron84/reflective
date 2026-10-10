import { headers } from "next/headers";
import { notFound } from "next/navigation";
import WatchGame from "@/components/watch-with/WatchGame";
import { getAuthContext } from "@/lib/auth/session";
import { SITE_URL } from "@/lib/config";
import { presentClub, previewMatches } from "@/lib/watch-with/access";
import { shareLabel, watchWithPaths } from "@/lib/watch-with/host";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params, searchParams }) {
  const { club: slug } = await params;
  const query = await searchParams;
  const preview = typeof query.preview === "string" ? query.preview : "";
  const club = await presentClub(slug);
  if (!club || (!club.active && !previewMatches(preview))) return { title: "Watch with" };
  return {
    title: `${club.headline} | ${club.name}`,
    description: club.subline,
    alternates: { canonical: `${SITE_URL}/watch-with/${club.slug}` },
    robots: club.active ? { index: true, follow: true } : { index: false, follow: false },
  };
}

export default async function WatchWithPage({ params, searchParams }) {
  const { club: slug } = await params;
  const query = await searchParams;
  const preview = typeof query.preview === "string" ? query.preview : "";
  const club = await presentClub(slug);
  if (!club || (!club.active && !previewMatches(preview))) notFound();
  const hdrs = await headers();
  const paths = watchWithPaths(hdrs.get("host"), club.slug);
  const auth = await getAuthContext();
  const accountEmail = auth.isSignedIn ? String(auth.user?.email || "") : "";
  return (
    <WatchGame
      club={club.slug}
      clubName={club.shortName}
      shortName={club.shortName}
      headline={club.headline}
      subline={club.subline}
      rankingHref={paths.ranking}
      accent={club.accentColor}
      primary={club.primaryColor}
      shareHost={shareLabel(club.slug)}
      preview={club.active ? "" : preview}
      accountEmail={accountEmail}
    />
  );
}
