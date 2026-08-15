import Link from "next/link";
import { requireUltimaManager } from "@/lib/ultima/gates";
import { getAdminLog } from "@/lib/ultima/server/admin";
import styles from "@/components/ultima/ultima.module.css";

export const metadata = {
  title: "Ultima · Log",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UltimaLogPage() {
  await requireUltimaManager("/ultima/log");
  const entries = await getAdminLog(100);

  return (
    <div className={styles.ultimaPage}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>GAMES · ULTIMA</p>
        <h1 className={styles.title}>Commissioner log</h1>
        <p className={styles.lede}>Public audit trail. Append only.</p>

        <ul className={styles.logList}>
          {entries.map((e) => (
            <li key={e.id} className={styles.logRow}>
              <time className={styles.logTime}>
                {new Date(e.created_at).toLocaleString("en-GB", {
                  timeZone: "Asia/Dubai",
                })}
              </time>
              <strong>{e.action}</strong>
              {e.reason ? <span> · {e.reason}</span> : null}
            </li>
          ))}
        </ul>

        {entries.length === 0 ? (
          <p className={styles.emptyState}>No commissioner actions yet.</p>
        ) : null}

        <Link href="/ultima" className={styles.quietLink}>
          Back to hub
        </Link>
      </div>
    </div>
  );
}
