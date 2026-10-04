"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { draftRoomWindow } from "@/lib/ultima/draft-window";
import { formatCountdown, formatGstTime } from "@/lib/ultima/gst";
import UltimaStaffMessage from "./UltimaStaffMessage";
import styles from "./ultima.module.css";

/** Shown before the season draft room opens. No room, no picks. */
export default function UltimaDraftClosed({ scheduledAt }) {
  const router = useRouter();
  // No clock on the server render, so the countdown cannot mismatch on hydrate.
  const [now, setNow] = useState(null);
  const win = draftRoomWindow({ scheduledAt, now: now ?? 0 });

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (now != null && win.open) router.refresh();
  }, [now, win.open, router]);

  return (
    <div className={`${styles.draftRoom} ${styles.draftOffice} ${styles.dLobby} ultima-live-chrome-off`}>
      <UltimaStaffMessage
        subject={`Draft room opens ${formatGstTime(win.opensAt)} GST`}
        body={
          now == null
            ? `First pick ${formatGstTime(win.startsAt)} GST.`
            : `Opens in ${formatCountdown(win.msToOpen)}. First pick ${formatGstTime(win.startsAt)} GST.`
        }
        actionLabel="Back to the hub"
        href="/ultima"
      />
    </div>
  );
}
