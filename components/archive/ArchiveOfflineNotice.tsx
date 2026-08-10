"use client";

import { useEffect, useState } from "react";
import styles from "./ArchiveOfflineNotice.module.css";

type ArchiveOfflineNoticeProps = {
  force?: boolean;
};

export default function ArchiveOfflineNotice({
  force = false,
}: ArchiveOfflineNoticeProps) {
  const [offline, setOffline] = useState(force);

  useEffect(() => {
    if (force) {
      setOffline(true);
      return;
    }

    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, [force]);

  if (!offline) return null;

  return (
    <p className={styles.notice} role="status">
      You are offline. Showing what is saved on this device.
    </p>
  );
}
