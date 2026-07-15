import HomeTree from "@/components/home/HomeTree";
import { getVotingState } from "@/lib/config";

export default function Home() {
  return <HomeTree showVotingDate={getVotingState() === "open"} />;
}
