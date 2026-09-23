import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import UltimaHub from "@/components/ultima/UltimaHub";
import styles from "@/components/ultima/ultima.module.css";
import { getAuthContext } from "@/lib/auth/session";
import { ULTIMA_ENABLED } from "@/lib/config";
import { isUltimaAppHost } from "@/lib/ultima/host";
import { getActiveCompetition, getManagerForUser } from "@/lib/ultima/server/db";
import { getCurrentGameweek } from "@/lib/ultima/server/bootstrap";
import { getHubOffice } from "@/lib/ultima/server/hub";
import { safeResolve } from "@/lib/ultima/server/safe";

export const metadata = {
  title: "Ultima",
  description:
    "Draft Europe's top five. Thirty players. Fifteen score each week. Invite only. The Reflective Football fantasy league.",
  alternates: { canonical: "/ultima" },
  robots: ULTIMA_ENABLED ? undefined : { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UltimaPage() {
  const auth = await safeResolve(getAuthContext(), {
    user: null,
    profile: null,
    isSignedIn: false,
  });
  const competition = await getActiveCompetition();
  const manager =
    auth.isSignedIn && auth.user
      ? await getManagerForUser(auth.user.id)
      : null;
  const appHost = isUltimaAppHost((await headers()).get("host"));

  if (appHost && !manager) {
    redirect("/ultima/join");
  }

  let gameweekNumber = null;
  if (competition && !manager) {
    const gameweek = await safeResolve(getCurrentGameweek(competition.id), null);
    if (Number.isInteger(gameweek?.number) && gameweek.number > 0) {
      gameweekNumber = gameweek.number;
    }
  }

  const office =
    competition && manager
      ? await safeResolve(
          getHubOffice({
            competitionId: competition.id,
            managerId: manager.id,
          }),
          null,
        )
      : null;

  return (
    <div className={styles.ultimaPage}>
      <div className={`${styles.inner} ${styles.innerWide}`}>
        {manager ? null : (
          <>
            <p className={styles.eyebrow}>Ultima</p>
            <h1 className={styles.displayTitle}>Ultima</h1>
            <p className={styles.dateline}>{formatDateline(competition?.season_label, gameweekNumber)}</p>
            <p className={styles.lede}>
              Draft Europe's top five. Thirty players. Fifteen score each week. Invite only.
            </p>
          </>
        )}
        {!ULTIMA_ENABLED ? (
          <p className={styles.phaseNote}>Invite only. Opens when the commissioner is ready.</p>
        ) : null}
        {manager ? null : <hr className={styles.rule} />}
        <UltimaHub
          isSignedIn={auth.isSignedIn}
          manager={manager}
          office={office}
        />
        <p className={styles.hubNote}>
          <Link href="/ultima/rules" className={styles.quietLink}>
            Read the rules
          </Link>
          {appHost ? null : (
            <>
              {" · "}
              <Link href="/games" className={styles.quietLink}>
                All games
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function formatDateline(seasonLabel, gameweekNumber) {
  const date = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Dubai",
  }).format(new Date());

  const parts = [];
  if (seasonLabel) parts.push(seasonLabel);
  if (gameweekNumber) parts.push(`Gameweek ${gameweekNumber}`);
  parts.push(date);
  return parts.join(" · ");
}
