import { redirect } from "next/navigation";
import UltimaAdminClient from "@/components/ultima/UltimaAdminClient";
import { profileIsAdmin } from "@/lib/auth/admin";
import { getAuthContext } from "@/lib/auth/session";
import {
  countHumanManagers,
  getActiveCompetitionStrict,
  isCommissionerUser,
} from "@/lib/ultima/server/db";
import { getAdminOffice } from "@/lib/ultima/server/admin";
import { loadStrict } from "@/lib/ultima/server/safe";
import UltimaDidNotLoad from "@/components/ultima/UltimaDidNotLoad";
import styles from "@/components/ultima/ultima.module.css";

export const metadata = {
  title: "Ultima · Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UltimaAdminPage() {
  const auth = await getAuthContext();
  if (!auth.isSignedIn) {
    redirect("/signin?next=/ultima/admin");
  }
  if (!isCommissionerUser(auth.user.id) && !profileIsAdmin(auth.profile)) {
    redirect("/ultima");
  }

  let competition = null;
  let office = null;
  let managerCount = 0;
  try {
    competition = await loadStrict(getActiveCompetitionStrict());
    if (competition) {
      office = await loadStrict(getAdminOffice(competition.id), 12000);
      managerCount = await loadStrict(countHumanManagers(competition.id, { strict: true }));
    }
  } catch {
    return <UltimaDidNotLoad subject="The admin desk" />;
  }

  return (
    <div className={styles.ultimaPage}>
      <div className={`${styles.inner} ${styles.innerWide}`}>
        <UltimaAdminClient
          office={office}
          seasonLabel={office?.seasonLabel ?? competition?.season_label ?? "2026/27"}
          timerSeconds={office?.timerSeconds ?? competition?.timer_seconds ?? 60}
          managers={office?.managers ?? []}
          gameweeks={office?.gameweeks ?? []}
          managerCount={managerCount ?? 0}
        />
      </div>
    </div>
  );
}
