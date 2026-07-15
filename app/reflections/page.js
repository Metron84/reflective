import {
  REFLECTIONS_CATEGORIES,
  getVotingState,
  reflectionsWinnersHeroLine,
} from "@/lib/config";
import { getNomineesByCategory, getVoteCookieState } from "@/lib/reflections";
import SectionHeader from "@/components/SectionHeader";
import VotingBoard from "@/components/reflections/VotingBoard";

export const metadata = {
  title: "The Reflections",
  description:
    "Eight awards for the fans of the summer. Watch the nominees and cast your vote.",
};

export const dynamic = "force-dynamic";

export default async function ReflectionsPage() {
  const votingState = getVotingState();
  const nomineesByCategory = await getNomineesByCategory();
  const { categories: voted, picks } = await getVoteCookieState();
  const winnersLine = reflectionsWinnersHeroLine();

  return (
    <div>
      <section className="flex min-h-[60vh] flex-col items-center justify-center bg-gradient-to-b from-navy to-navy-deep px-6 py-24 text-center">
        <SectionHeader
          variant="navy"
          eyebrow="Awards. For the Fans."
          title="The Reflections"
          context="Eight awards for the fans of the summer. Your vote decides."
        />
        {votingState === "open" ? (
          <p className="mt-8 text-sm text-paper/50">{winnersLine}</p>
        ) : votingState === "before" ? (
          <p className="mt-8 text-sm text-paper/50">Voting opens soon.</p>
        ) : (
          <p className="mt-8 text-sm text-paper/50">{winnersLine}</p>
        )}
      </section>

      <VotingBoard
        categories={REFLECTIONS_CATEGORIES}
        nomineesByCategory={nomineesByCategory}
        initialVoted={voted}
        initialPicks={picks}
        votingState={votingState}
      />
    </div>
  );
}
