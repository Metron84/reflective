"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import UltimaDraftRoom from "./UltimaDraftRoom";
import styles from "./ultima.module.css";

export default function UltimaPracticeRoom({ code, managerId, isHost }) {
  const [lobby, setLobby] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/ultima/practice?code=${encodeURIComponent(code)}`);
        const data = await res.json();
        if (!cancelled && res.ok) setLobby(data);
      } catch {
        /* retry on interval */
      }
    }
    load();
    const poll = setInterval(load, 2500);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [code]);

  async function start() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/ultima/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", code }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.message ?? "Could not start.");
      else {
        const next = await fetch(`/api/ultima/practice?code=${encodeURIComponent(code)}`);
        setLobby(await next.json());
      }
    } finally {
      setBusy(false);
    }
  }

  if (!lobby) {
    return (
      <div className={styles.navyRoom}>
        <p className={styles.navyText}>Loading practice room…</p>
      </div>
    );
  }

  if (lobby.state === "lobby") {
    return (
      <div className={styles.ultimaPage}>
        <div className={styles.inner}>
          <p className={styles.eyebrow}>GAMES · ULTIMA · PRACTICE</p>
          <h1 className={styles.title}>Room {code}</h1>
          <p className={styles.lede}>
            Share this code with other invitees. Bots fill empty seats when the host starts.
          </p>
          <p className={styles.hubNote}>
            {(lobby.humans ?? []).length} human{(lobby.humans ?? []).length === 1 ? "" : "s"} in the lobby.
          </p>
          <ul className={styles.doorList}>
            {(lobby.humans ?? []).map((m) => (
              <li key={m.id} className={styles.hubNote}>
                {m.team_name}
              </li>
            ))}
          </ul>
          {isHost ? (
            <button type="button" className={styles.primaryBtn} onClick={start} disabled={busy}>
              {busy ? "Starting…" : "Start practice draft"}
            </button>
          ) : (
            <p className={styles.hubNote}>Waiting for the host to start.</p>
          )}
          {error ? <p className={styles.messageError}>{error}</p> : null}
          <Link href="/ultima/practice" className={styles.quietLink}>
            Leave room
          </Link>
        </div>
      </div>
    );
  }

  return <UltimaDraftRoom managerId={managerId} variant="practice" roomCode={code} />;
}
