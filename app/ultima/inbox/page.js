import UltimaInboxClient from "@/components/ultima/UltimaInboxClient";
import UltimaSeatRetry from "@/components/ultima/UltimaSeatRetry";
import styles from "@/components/ultima/ultima.module.css";
import { listInbox } from "@/lib/ultima/server/notifications";
import { requireSeat } from "@/lib/ultima/server/requireSeat";

export const metadata = {
  title: "Ultima · Inbox",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UltimaInboxPage() {
  const seat = await requireSeat("/ultima/inbox");
  if (seat.status === "unavailable") return <UltimaSeatRetry />;

  const items = await listInbox(seat.manager.id);

  return (
    <div className={styles.ultimaPage}>
      <div className={`${styles.inner} ${styles.innerWide}`}>
        <UltimaInboxClient initialItems={items} />
      </div>
    </div>
  );
}
