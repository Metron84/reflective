import { headers } from "next/headers";
import { notFound } from "next/navigation";
import WatchGame from "@/components/watch-with/WatchGame";
import { SITE_URL } from "@/lib/config";
import { getClub } from "@/lib/watch-with/clubs";
import { watchWithPaths } from "@/lib/watch-with/host";

export async function generateMetadata({ params }) {
  const { club: slug } = await params;
  const club = getClub(slug);
  if (!club) return { title: "Watch with" };
  return {
    title: `${club.headline} | The Reflective Football`,
    description: club.subline,
    alternates: { canonical: `${SITE_URL}/watch-with/${club.slug}` },
  };
}

export default async function WatchWithPage({ params }) {
  const { club: slug } = await params;
  const club = getClub(slug);
  if (!club) notFound();
  const hdrs = await headers();
  const paths = watchWithPaths(hdrs.get("host"), club.slug);
  return (
    <WatchGame
      club={club.slug}
      clubName={club.name}
      headline={club.headline}
      subline={club.subline}
      rankingHref={paths.ranking}
    />
  );
}
