"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import UltimaStaffMessage from "@/components/ultima/UltimaStaffMessage";
import { isUltimaAppHost } from "@/lib/ultima/host";
import styles from "@/components/ultima/ultima.module.css";

export default function UltimaError({ reset }) {
  const [appHost, setAppHost] = useState(false);

  useEffect(() => {
    setAppHost(isUltimaAppHost(window.location.host));
  }, []);

  return (
    <div className={styles.ultimaPage}>
      <div className={styles.inner}>
        <UltimaStaffMessage
          subject="The hub did not load"
          body={appHost ? "Try again, or open Join or Rules." : "Try again, or open Join, Rules, or All games."}
          actionLabel="Try again"
          onAction={() => reset()}
        />
        <p className={styles.hubNote}>
          <Link href="/ultima/join" className={styles.quietLink}>
            Join
          </Link>
          {" · "}
          <Link href="/ultima/rules" className={styles.quietLink}>
            Rules
          </Link>
          {appHost ? null : (
            <>
              {" · "}
              <Link href="/games" className={styles.quietLink}>
                All games
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
