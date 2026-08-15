import Link from "next/link";
import { requireUltimaManager } from "@/lib/ultima/gates";
import { getUltimaDb } from "@/lib/ultima/server/db";
import styles from "@/components/ultima/ultima.module.css";

export const metadata = {
  title: "Ultima · Trade",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UltimaTradeDetailPage({ params }) {
  const { manager } = await requireUltimaManager("/ultima/trades");
  const { id } = await params;

  const db = getUltimaDb();
  const { data: trade } = await db
    .from("ultima_trades")
    .select("*, ultima_trade_players(*, ultima_players(name, league, club))")
    .eq("id", id)
    .maybeSingle();

  if (!trade) {
    return (
      <div className={styles.ultimaPage}>
        <div className={styles.inner}>
          <h1 className={styles.title}>Trade not found</h1>
          <Link href="/ultima/trades" className={styles.quietLink}>
            Back to trades
          </Link>
        </div>
      </div>
    );
  }

  const isReceiver = trade.receiver_id === manager.id;
  const verdict = trade.verdict_json?.message ?? "";

  return (
    <div className={styles.ultimaPage}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>GAMES · ULTIMA</p>
        <h1 className={styles.title}>Trade review</h1>
        <p className={styles.lede}>
          {trade.state} · {verdict}
        </p>

        <ul className={styles.tradeList}>
          {(trade.ultima_trade_players ?? []).map((tp) => (
            <li key={`${tp.player_id}-${tp.from_manager_id}`} className={styles.tradeRow}>
              {tp.ultima_players?.name} · {tp.ultima_players?.club}
              {tp.from_manager_id === manager.id ? " (you give)" : " (you get)"}
            </li>
          ))}
        </ul>

        {isReceiver && trade.state === "proposed" ? (
          <p className={styles.hubNote}>Accept or decline from the trades list.</p>
        ) : null}

        <Link href="/ultima/trades" className={styles.quietLink}>
          Back to trades
        </Link>
      </div>
    </div>
  );
}
