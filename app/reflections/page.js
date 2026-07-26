import {
  getReflectionsLiveCategories,
  getVotingState,
} from "@/lib/config";
import {
  getNomineesByCategory,
  getVoteCookieState,
  getUserReflectionsVotes,
  getStandingsForCategories,
} from "@/lib/reflections";
import { getAuthContext } from "@/lib/auth/session";
import ReflectivesHero from "@/components/reflections/ReflectivesHero";
import VotingBoard from "@/components/reflections/VotingBoard";

export const metadata = {
  title: "The Reflectives",
  description:
    "Eight awards for the fans of the summer. Watch the nominees. Sign up free to vote.",
  openGraph: {
    title: "The Reflectives | The Reflective Football",
    description:
      "Eight awards for the fans of the summer. Watch the nominees. Sign up free to vote.",
  },
  twitter: {
    title: "The Reflectives | The Reflective Football",
    description:
      "Eight awards for the fans of the summer. Watch the nominees. Sign up free to vote.",
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
  const liveCategories = getReflectionsLiveCategories();
  const initialStandings =
    isSignedIn && voted.length
      ? await getStandingsForCategories(voted)
      : {};

  return (
    <div>
      <ReflectivesHero votingState={votingState} isSignedIn={isSignedIn} />

      <VotingBoard
        navCategories={liveCategories}
        bodyCategories={liveCategories}
        totalCategoryCount={liveCategories.length}
        nomineesByCategory={nomineesByCategory}
        initialVoted={voted}
        initialPicks={picks}
        initialStandings={initialStandings}
        votingState={votingState}
        isSignedIn={isSignedIn}
      />
    </div>
  );
}
