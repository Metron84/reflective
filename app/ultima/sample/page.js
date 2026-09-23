import Link from "next/link";
import { notFound } from "next/navigation";
import UltimaPanel from "@/components/ultima/UltimaPanel";
import UltimaSquadClient from "@/components/ultima/UltimaSquadClient";
import styles from "@/components/ultima/ultima.module.css";
import {
  sampleAllLockedState,
  sampleLiveState,
  sampleSquadTabState,
  sampleXvState,
} from "@/lib/ultima/sample/squad-preview";

export const metadata = {
  title: "Ultima · SAMPLE",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const VIEWS = [
  { href: "/ultima/sample", id: "xv", label: "XV" },
  { href: "/ultima/sample?view=sheet", id: "sheet", label: "Pick sheet" },
  { href: "/ultima/sample?view=live", id: "live", label: "Matchday" },
  { href: "/ultima/sample?view=locked", id: "locked", label: "Locked" },
  { href: "/ultima/sample?view=all30", id: "all30", label: "All 30" },
];

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

  return (
    <div className={styles.ultimaPage}>
      <div className={`${styles.inner} ${styles.innerWide}`}>
        <div className={styles.utPage}>
          <UltimaPanel title="Views" sample>
            <nav className={styles.utChips} aria-label="SAMPLE views">
              {VIEWS.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className={
                    (view === "squad" ? "all30" : view) === item.id
                      ? styles.deskTabOn
                      : styles.deskTab
                  }
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </UltimaPanel>
          <UltimaSquadClient
            roster={pack.roster}
            lineup={pack.lineup}
            gameweek={pack.gameweek}
            lockedLeagues={pack.lockedLeagues}
            liveTotal={pack.liveTotal}
            preview
            openSheetOnMount={view === "sheet"}
          />
        </div>
      </div>
    </div>
  );
}
