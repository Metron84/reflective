import {
  getReflectionsLiveCategories,
  getVotingState,
  reflectionsWinnersHeroLine,
} from "@/lib/config";
import {
  getNomineesByCategory,
  getVoteCookieState,
  getUserReflectionsVotes,
} from "@/lib/reflections";
import { getAuthContext } from "@/lib/auth/session";
import SectionHeader from "@/components/SectionHeader";
import VotingBoard from "@/components/reflections/VotingBoard";
import AwardsLaurelCover from "@/components/covers/AwardsLaurelCover";

export const metadata = {
  title: "The Reflections",
  description:
    "Eight awards for the fans of the summer. Watch the nominees and cast your vote.",
  openGraph: {
    title: "The Reflections | The Reflective Football",
    description:
      "Eight awards for the fans of the summer. Watch the nominees and cast your vote.",
  },
  twitter: {
    title: "The Reflections | The Reflective Football",
    description:
      "Eight awards for the fans of the summer. Watch the nominees and cast your vote.",
  },
};

export const dynamic = "force-dynamic";

export default async function ReflectionsPage() {
  const votingState = getVotingState();
  const nomineesByCategory = await getNomineesByCategory();
  const { isSignedIn, user } = await getAuthContext();
  const cookieState = await getVoteCookieState();
  const dbVotes = isSignedIn
    ? await getUserReflectionsVotes(user.id)
    : { categories: [], picks: {} };

  const voted = isSignedIn ? dbVotes.categories : cookieState.categories;
  const picks = isSignedIn ? dbVotes.picks : cookieState.picks;
  const winnersLine = reflectionsWinnersHeroLine();
  const liveCategories = getReflectionsLiveCategories();

  return (
    <div>
      <section className="relative flex min-h-[60vh] flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-navy to-navy-deep px-6 py-24 text-center">
        <div className="pointer-events-none absolute inset-0 opacity-40">
          <AwardsLaurelCover subtle />
        </div>
        <div className="relative z-10">
          <SectionHeader
            variant="navy"
            eyebrow="Awards. For the Fans."
            title="The Reflections"
            context="Eight awards for the fans of the summer. Your vote decides."
          />
          {votingState === "open" ? (
            <p className="mt-8 text-sm text-paper/50">
              Voting is open. {winnersLine}
            </p>
          ) : votingState === "before" ? (
            <p className="mt-8 text-sm text-paper/50">Voting opens soon.</p>
          ) : (
            <p className="mt-8 text-sm text-paper/50">{winnersLine}</p>
          )}
        </div>
      </section>

      <VotingBoard
        navCategories={liveCategories}
        bodyCategories={liveCategories}
        totalCategoryCount={liveCategories.length}
        nomineesByCategory={nomineesByCategory}
        initialVoted={voted}
        initialPicks={picks}
        votingState={votingState}
        isSignedIn={isSignedIn}
      />
    </div>
  );
}
