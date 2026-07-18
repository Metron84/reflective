import HomeTree from "@/components/home/HomeTree";
import { getVotingState } from "@/lib/config";
import { getAuthContext } from "@/lib/auth/session";

export default async function Home() {
  const { isSignedIn } = await getAuthContext();

  return (
    <HomeTree
      showVotingDate={getVotingState() === "open"}
      isSignedIn={isSignedIn}
    />
  );
}
