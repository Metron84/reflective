import Link from "next/link";
import UltimaDraftClosed from "@/components/ultima/UltimaDraftClosed";
import UltimaDraftRoom from "@/components/ultima/UltimaDraftRoom";
import { draftRoomWindow } from "@/lib/ultima/draft-window";
import { getActiveCompetition, getUltimaDb } from "@/lib/ultima/server/db";
import { requireUltimaManager } from "@/lib/ultima/gates";
import styles from "@/components/ultima/ultima.module.css";

export const metadata = {
  title: "Ultima · Draft",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UltimaDraftPage() {
  const { manager } = await requireUltimaManager("/ultima/draft");

  if (!manager?.profile_complete) {
    return (
      <div className={styles.ultimaPage}>
        <div className={styles.inner}>
          <p className={styles.eyebrow}>GAMES · ULTIMA</p>
          <h1 className={styles.title}>Draft room</h1>
          <p className={styles.lede}>Complete your profile before the draft room opens.</p>
          <Link href="/ultima/profile" className={styles.primaryBtn}>
            Complete profile
          </Link>
        </div>
      </div>
    );
  }

  // Before the room opens (10 minutes ahead of the first pick) there is no room.
  // Once the draft is live, paused or complete, the gate never applies.
  const competition = await getActiveCompetition();
  const db = getUltimaDb();
  if (competition && db) {
    const { data: draft } = await db
      .from("ultima_draft_state")
      .select("state, scheduled_at")
      .eq("competition_id", competition.id)
      .maybeSingle();
    if (draft?.state === "lobby" && draft.scheduled_at) {
      const window = draftRoomWindow({ scheduledAt: draft.scheduled_at });
      if (!window.open) return <UltimaDraftClosed scheduledAt={draft.scheduled_at} />;
    }
  }

  return <UltimaDraftRoom managerId={manager.id} />;
}
