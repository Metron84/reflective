import UltimaTradesClient from "@/components/ultima/UltimaTradesClient";
import { requireUltimaManager } from "@/lib/ultima/gates";
import { getActiveCompetition, getUltimaDb } from "@/lib/ultima/server/db";
import { listTrades } from "@/lib/ultima/server/trades";
import { getManagerRoster } from "@/lib/ultima/server/lineup";
import { getCurrentGameweek } from "@/lib/ultima/server/bootstrap";
import { ULTIMA_TRADE_OPENS_GW } from "@/lib/ultima/constants";
import styles from "@/components/ultima/ultima.module.css";

export const metadata = {
  title: "Ultima · Trades",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UltimaTradesPage() {
  const { manager } = await requireUltimaManager("/ultima/trades");
  const competition = await getActiveCompetition();
  const gameweek = competition ? await getCurrentGameweek(competition.id) : null;
  const gwNumber = gameweek?.number ?? 0;
  const tradesOpen = gwNumber >= ULTIMA_TRADE_OPENS_GW;

  const db = getUltimaDb();
  const { data: managers } = competition
    ? await db
        .from("ultima_managers")
        .select("id, team_name, is_bot")
        .eq("competition_id", competition.id)
    : { data: [] };

  const trades = competition ? await listTrades(competition.id, manager.id) : [];
  const roster = await getManagerRoster(manager.id);

  const rostersByManager = {};
  for (const m of managers ?? []) {
    if (!m.is_bot) {
      rostersByManager[m.id] = await getManagerRoster(m.id);
    }
  }

  return (
    <div className={styles.ultimaPage}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>GAMES · ULTIMA</p>
        <h1 className={styles.title}>Trades</h1>
        <UltimaTradesClient
          trades={trades}
          managers={managers ?? []}
          myId={manager.id}
          roster={roster}
          rostersByManager={rostersByManager}
          tradesOpen={tradesOpen}
          gameweekNumber={gwNumber}
        />
      </div>
    </div>
  );
}
