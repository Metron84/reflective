import UltimaPracticeLobby from "@/components/ultima/UltimaPracticeLobby";
import styles from "@/components/ultima/ultima.module.css";
import { requireUltimaManager } from "@/lib/ultima/gates";

export const metadata = {
  title: "Ultima · Practice draft",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UltimaPracticePage() {
  const { manager } = await requireUltimaManager("/ultima/practice");

  if (!manager?.profile_complete) {
    return (
      <div className={styles.ultimaPage}>
        <div className={styles.inner}>
          <p className={styles.eyebrow}>GAMES · ULTIMA</p>
          <h1 className={styles.title}>Practice draft</h1>
          <p className={styles.lede}>Complete your profile before you practise.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.ultimaPage}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>GAMES · ULTIMA</p>
        <h1 className={styles.title}>Practice draft</h1>
        <UltimaPracticeLobby />
      </div>
    </div>
  );
}
