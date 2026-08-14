import { redirect } from "next/navigation";
import UltimaProfileForm from "@/components/ultima/UltimaProfileForm";
import styles from "@/components/ultima/ultima.module.css";
import { requireUltimaManager } from "@/lib/ultima/gates";

export const metadata = {
  title: "Ultima · Profile",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UltimaProfilePage() {
  const { auth, manager } = await requireUltimaManager("/ultima/profile");

  if (!manager) {
    redirect("/ultima");
  }

  if (manager.profile_complete) {
    redirect("/ultima");
  }

  return (
    <div className={styles.ultimaPage}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>GAMES · ULTIMA</p>
        <h1 className={styles.title}>Your team</h1>
        <p className={styles.lede}>Name your side before the draft room opens.</p>
        <UltimaProfileForm
          defaultManagerName={auth.profile?.preferred_name ?? ""}
          defaultTeamName={manager.team_name ?? ""}
          defaultColour={manager.colour ?? "navy"}
        />
      </div>
    </div>
  );
}
