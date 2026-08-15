import { redirect } from "next/navigation";
import UltimaPracticeRoom from "@/components/ultima/UltimaPracticeRoom";
import { requireUltimaManager } from "@/lib/ultima/gates";
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
  const { auth, manager } = await requireUltimaManager("/ultima/practice");
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
