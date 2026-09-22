import Link from "next/link";
import UltimaRoomHead from "@/components/ultima/UltimaRoomHead";
import { requireUltimaManager } from "@/lib/ultima/gates";
import { getUltimaDb } from "@/lib/ultima/server/db";
import styles from "@/components/ultima/ultima.module.css";

export const metadata = {
  title: "Ultima · Trade",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function labelTradeState(state) {
  if (state === "proposed") return "Proposal";
  if (state === "review") return "League review";
  if (state === "declined") return "Declined";
  if (state === "vetoed") return "Vetoed";
  if (state === "executed") return "Done";
  return state ?? "";
}

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
          <UltimaRoomHead title="Trade not found" kicker="Desk" />
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
        <UltimaRoomHead title="Trade review" kicker="Desk" />
        <section className={styles.officePanel}>
          <p className={styles.hubNote}>
            {labelTradeState(trade.state)}
            {verdict ? ` · ${verdict}` : ""}
          </p>
          <ul className={styles.inboxList}>
            {(trade.ultima_trade_players ?? []).map((tp) => (
              <li key={`${tp.player_id}-${tp.from_manager_id}`} className={styles.inboxItem}>
                <span className={styles.inboxStamp}>
                  {tp.from_manager_id === manager.id ? "Give" : "Get"}
                </span>
                <span className={styles.inboxLine}>{tp.ultima_players?.name}</span>
                <span className={styles.inboxMeta}>{tp.ultima_players?.club}</span>
              </li>
            ))}
          </ul>
        </section>

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
