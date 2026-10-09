import { notFound } from "next/navigation";
import RankingBoard from "@/components/watch-with/RankingBoard";
import { SITE_URL } from "@/lib/config";
import { getClub } from "@/lib/watch-with/clubs";
import { rankingFor } from "@/lib/watch-with/store";

export async function generateMetadata({ params }) {
  const { club: slug } = await params;
  const club = getClub(slug);
  if (!club) return { title: "Ranking" };
  return {
    title: `Matchday companion ranking | ${club.name}`,
    description: club.subline,
    alternates: { canonical: `${SITE_URL}/watch-with/${club.slug}/ranking` },
  };
}

export default async function RankingPage({ params }) {
  const { club: slug } = await params;
  const club = getClub(slug);
  if (!club) notFound();
  let board = { rows: [], fans: 0 };
  try {
    const data = await rankingFor(slug);
    if (data) board = data;
  } catch (error) {
    console.error("watch-with/ranking", error);
  }
  return (
    <RankingBoard
      club={club.slug}
      clubName={club.name}
      headline="Who would you rather watch the match with?"
      rows={board.rows}
      fans={board.fans}
    />
  );
}
