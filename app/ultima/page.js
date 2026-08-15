import Link from "next/link";
import UltimaHub from "@/components/ultima/UltimaHub";
import styles from "@/components/ultima/ultima.module.css";
import { getAuthContext } from "@/lib/auth/session";
import { ULTIMA_ENABLED } from "@/lib/config";
import {
  getActiveCompetition,
  getManagerForUser,
  getUltimaDb,
} from "@/lib/ultima/server/db";
import { getHubStatus } from "@/lib/ultima/server/admin";
import { getCompetitionNews } from "@/lib/ultima/server/news";
import { listHubTradeCards } from "@/lib/ultima/server/trades";
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

  let hubStatus = null;
  let draftState = "lobby";
  let news = [];
  let tradeCards = [];
  if (competition && manager) {
    hubStatus = await safeResolve(
      getHubStatus(competition.id, manager.id),
      null,
    );
    news = await safeResolve(getCompetitionNews(competition.id), []);
    tradeCards = await safeResolve(listHubTradeCards(competition.id, manager.id), []);
    const db = getUltimaDb();
    if (db) {
      const ds = await safeResolve(
        db
          .from("ultima_draft_state")
          .select("state")
          .eq("competition_id", competition.id)
          .maybeSingle()
          .then(({ data }) => data),
        null,
      );
      draftState = ds?.state ?? hubStatus?.draft ?? "lobby";
    } else {
      draftState = hubStatus?.draft ?? "lobby";
    }
  }

  return (
    <div className={styles.ultimaPage}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>GAMES · ULTIMA</p>
        <h1 className={styles.title}>Ultima</h1>
        <p className={styles.lede}>
          League news and the room. Draft Europe's top five. Invite only.
        </p>
        {!ULTIMA_ENABLED ? (
          <p className={styles.phaseNote}>Invite only. Opens when the commissioner is ready.</p>
        ) : null}
        {competition ? (
          <p className={styles.hubNote}>Season {competition.season_label}</p>
        ) : null}
        <hr className={styles.rule} />
        <UltimaHub
          isSignedIn={auth.isSignedIn}
          manager={manager}
          draftState={draftState}
          hubStatus={hubStatus}
          news={news}
          tradeCards={tradeCards}
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
