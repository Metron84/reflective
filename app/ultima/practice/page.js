import UltimaPracticeLobby from "@/components/ultima/UltimaPracticeLobby";
import UltimaStaffMessage from "@/components/ultima/UltimaStaffMessage";
import styles from "@/components/ultima/ultima.module.css";
import { requireUltimaManager } from "@/lib/ultima/gates";
import { listMyPracticeRooms } from "@/lib/ultima/server/practice";

export const metadata = {
  title: "Ultima · Pre-draft",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UltimaPracticePage() {
  const { auth, manager } = await requireUltimaManager("/ultima/practice");

  if (!manager?.profile_complete) {
    return (
      <div className={styles.ultimaPage}>
        <div className={`${styles.inner} ${styles.innerWide}`}>
          <UltimaStaffMessage
            subject="Complete your profile first"
            body="The scouting desk opens after your club name is set."
            actionLabel="Profile"
            href="/ultima/profile"
          />
        </div>
      </div>
    );
  }

  let rooms = [];
  try {
    rooms = await listMyPracticeRooms(auth.user.id);
  } catch {
    rooms = [];
  }

  return (
    <div className={styles.ultimaPage}>
      <div className={`${styles.inner} ${styles.innerWide}`}>
        <UltimaPracticeLobby rooms={rooms} />
      </div>
    </div>
  );
}
