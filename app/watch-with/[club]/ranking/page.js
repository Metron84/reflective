import { headers } from "next/headers";
import { notFound } from "next/navigation";
import RankingBoard from "@/components/watch-with/RankingBoard";
import { SITE_URL } from "@/lib/config";
import { presentClub, previewMatches } from "@/lib/watch-with/access";
import { watchWithPaths } from "@/lib/watch-with/host";
import { rankingFor } from "@/lib/watch-with/store";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params, searchParams }) {
  const { club: slug } = await params;
  const query = await searchParams;
  const preview = typeof query.preview === "string" ? query.preview : "";
  const club = await presentClub(slug);
  if (!club || (!club.active && !previewMatches(preview))) return { title: "Ranking" };
  return {
    title: `Matchday companion ranking | ${club.name}`,
    description: `Who ${club.fanLabel} would rather watch the match with.`,
    alternates: { canonical: `${SITE_URL}/watch-with/${club.slug}/ranking` },
    robots: club.active ? { index: true, follow: true } : { index: false, follow: false },
  };
}

export default async function RankingPage({ params, searchParams }) {
  const { club: slug } = await params;
  const query = await searchParams;
  const preview = typeof query.preview === "string" ? query.preview : "";
  const club = await presentClub(slug);
  if (!club || (!club.active && !previewMatches(preview))) notFound();
  let board = { segments: { all: [], fan: [], rival: [] }, runs: { all: 0, fan: 0, rival: 0 } };
  try {
    const data = await rankingFor(slug);
    if (data) board = data;
  } catch (error) {
    console.error("watch-with/ranking", error);
  }
  const hdrs = await headers();
  const paths = watchWithPaths(hdrs.get("host"), club.slug);
  return (
    <RankingBoard
      club={club.slug}
      clubName={club.name}
      fanLabel={club.fanLabel}
      headline="Who would you rather watch the match with?"
      segments={board.segments}
      runs={board.runs}
      gameHref={paths.game}
    />
  );
}
