import Link from "next/link";
import { notFound } from "next/navigation";
import UltimaSquadClient from "@/components/ultima/UltimaSquadClient";
import styles from "@/components/ultima/ultima.module.css";
import {
  sampleAllLockedState,
  sampleLiveState,
  sampleSquadTabState,
  sampleXvState,
} from "@/lib/ultima/sample/squad-preview";

export const metadata = {
  title: "Ultima · SAMPLE squad",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UltimaSampleSquadPage({ searchParams }) {
  if (process.env.NODE_ENV === "production") notFound();

  const params = await searchParams;
  const view = String(params?.view ?? "xv");
  const pack =
    view === "live"
      ? sampleLiveState()
      : view === "locked"
        ? sampleAllLockedState()
        : view === "all30" || view === "squad"
          ? sampleSquadTabState()
          : sampleXvState();

  const startView = view === "all30" || view === "squad" ? "all30" : "xv";

  return (
    <div className={styles.ultimaPage}>
      <div className={styles.inner}>
        <p className={styles.sampleBanner}>
          SAMPLE preview · not a live squad · development only
        </p>
        <nav className={styles.sampleLinks} aria-label="SAMPLE views">
          <Link href="/ultima/sample" className={styles.quietLink}>
            XV
          </Link>
          <Link href="/ultima/sample?view=sheet" className={styles.quietLink}>
            Pick sheet
          </Link>
          <Link href="/ultima/sample?view=live" className={styles.quietLink}>
            Matchday
          </Link>
          <Link href="/ultima/sample?view=locked" className={styles.quietLink}>
            Locked
          </Link>
          <Link href="/ultima/sample?view=all30" className={styles.quietLink}>
            All 30
          </Link>
        </nav>
        <UltimaSquadClient
          roster={pack.roster}
          lineup={pack.lineup}
          gameweek={pack.gameweek}
          lockedLeagues={pack.lockedLeagues}
          liveTotal={pack.liveTotal}
          preview
          startView={startView}
          openSheetOnMount={view === "sheet"}
        />
      </div>
    </div>
  );
}
