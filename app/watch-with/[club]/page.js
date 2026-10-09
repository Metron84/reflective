import { notFound } from "next/navigation";
import WatchGame from "@/components/watch-with/WatchGame";
import { SITE_URL } from "@/lib/config";
import { getClub } from "@/lib/watch-with/clubs";

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
  return <WatchGame club={club.slug} clubName={club.name} headline={club.headline} subline={club.subline} />;
}
