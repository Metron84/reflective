import { redirect } from "next/navigation";
import UltimaPracticeRoom from "@/components/ultima/UltimaPracticeRoom";
import UltimaSeatRetry from "@/components/ultima/UltimaSeatRetry";
import { requireSeat } from "@/lib/ultima/server/requireSeat";
import {
  getPracticeManager,
  getPracticeRoom,
  joinPracticeRoom,
  normalizeRoomCode,
} from "@/lib/ultima/server/practice";

export const metadata = {
  title: "Ultima · Practice room",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UltimaPracticeRoomPage({ params }) {
  const seat = await requireSeat("/ultima/practice");
  if (seat.status === "unavailable") return <UltimaSeatRetry />;
  const { auth, manager } = seat;
  const { code: raw } = await params;
  const code = normalizeRoomCode(raw);

  if (!manager?.profile_complete) {
    redirect("/ultima/profile");
  }

  const room = await getPracticeRoom(code);
  if (!room) {
    redirect("/ultima/practice");
  }

  let practiceManager = await getPracticeManager(auth.user.id, room.competition_id);
  if (!practiceManager) {
    const joined = await joinPracticeRoom({
      userId: auth.user.id,
      seasonManager: manager,
      code,
    });
    if (!joined.ok) {
      redirect("/ultima/practice");
    }
    practiceManager = { id: joined.managerId };
  }

  return (
    <UltimaPracticeRoom
      code={code}
      managerId={practiceManager.id}
      isHost={room.host_user_id === auth.user.id}
    />
  );
}
