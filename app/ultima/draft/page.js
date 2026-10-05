import Link from "next/link";
import UltimaDraftRoom from "@/components/ultima/UltimaDraftRoom";
import UltimaSeatRetry from "@/components/ultima/UltimaSeatRetry";
import { requireSeat } from "@/lib/ultima/server/requireSeat";
import styles from "@/components/ultima/ultima.module.css";

export const metadata = {
  title: "Ultima · Draft",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UltimaDraftPage() {
  const seat = await requireSeat("/ultima/draft");
  if (seat.status === "unavailable") return <UltimaSeatRetry />;
  const { manager } = seat;

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

  return <UltimaDraftRoom managerId={manager.id} />;
}
