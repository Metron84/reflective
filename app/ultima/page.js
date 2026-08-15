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
import { getCurrentGameweek } from "@/lib/ultima/server/bootstrap";
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
  let gameweekNumber = null;
  if (competition) {
    const gameweek = await safeResolve(getCurrentGameweek(competition.id), null);
    if (Number.isInteger(gameweek?.number) && gameweek.number > 0) {
      gameweekNumber = gameweek.number;
    }
  }
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
      <div className={`${styles.inner} ${styles.innerWide}`}>
        <p className={styles.eyebrow}>Games · Ultima</p>
        <h1 className={styles.displayTitle}>Ultima</h1>
        <p className={styles.dateline}>{formatDateline(competition?.season_label, gameweekNumber)}</p>
        <p className={styles.lede}>
          Draft Europe's top five. Thirty players. Fifteen score each week. Invite only.
        </p>
        {!ULTIMA_ENABLED ? (
          <p className={styles.phaseNote}>Invite only. Opens when the commissioner is ready.</p>
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

function formatDateline(seasonLabel, gameweekNumber) {
  const date = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Dubai",
  }).format(new Date());

  const parts = ["Ultima"];
  if (seasonLabel) parts.push(seasonLabel);
  if (gameweekNumber) parts.push(`Gameweek ${gameweekNumber}`);
  parts.push(date);
  return parts.join(" · ");
}
