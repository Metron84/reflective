import Link from "next/link";
import UltimaHub from "@/components/ultima/UltimaHub";
import styles from "@/components/ultima/ultima.module.css";
import { getAuthContext } from "@/lib/auth/session";
import { ULTIMA_ENABLED } from "@/lib/config";
import {
  getActiveCompetition,
  getManagerForUser,
} from "@/lib/ultima/server/db";

export const metadata = {
  title: "Ultima",
  description:
    "Draft PL, LaLiga, and Serie A. 25 players. Invite only. The Reflective Football fantasy league.",
  alternates: { canonical: "/ultima" },
  robots: ULTIMA_ENABLED ? undefined : { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UltimaPage() {
  const auth = await getAuthContext();
  const competition = await getActiveCompetition();
  const manager = auth.isSignedIn
    ? await getManagerForUser(auth.user.id)
    : null;

  return (
    <div className={styles.ultimaPage}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>GAMES · ULTIMA</p>
        <h1 className={styles.title}>Ultima</h1>
        <p className={styles.lede}>
          Draft Premier League, LaLiga, and Serie A. Twenty-five players. Ten seats. Invite only.
        </p>
        {!ULTIMA_ENABLED ? (
          <p className={styles.phaseNote}>
            Coming for the 26/27 season. The hub is in build preview for commissioners.
          </p>
        ) : null}
        {competition ? (
          <p className={styles.hubNote}>Season {competition.season_label}</p>
        ) : null}
        <hr className={styles.rule} />
        <UltimaHub
          isSignedIn={auth.isSignedIn}
          manager={manager}
        />
        <p className={styles.hubNote}>
          <Link href="/ultima/rules" className={styles.quietLink}>
            Read the rules
          </Link>
          {" · "}
          <Link href="/games" className={styles.quietLink}>
            All games
          </Link>
        </p>
      </div>
    </div>
  );
}
