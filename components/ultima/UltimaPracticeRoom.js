"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ULTIMA_DRAFT_ROUNDS,
  ULTIMA_MAX_SEATS,
  ULTIMA_SQUAD_FLOOR_PER_LEAGUE,
} from "@/lib/ultima/constants";
import UltimaDraftRoom from "./UltimaDraftRoom";
import UltimaPanel from "./UltimaPanel";
import UltimaRow from "./UltimaRow";
import UltimaStaffMessage from "./UltimaStaffMessage";
import styles from "./ultima.module.css";

export default function UltimaPracticeRoom({ code, managerId, isHost }) {
  const [lobby, setLobby] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const start = useCallback(async () => {
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
  }, [code]);

  if (!lobby) {
    return (
      <div className={`${styles.draftRoom} ${styles.draftOffice} ultima-live-chrome-off`}>
        <div className={styles.draftSkeleton} aria-busy="true" aria-label="Loading practice room">
          <div className={styles.draftSkeletonBar} />
          <div className={styles.draftSkeletonChip} />
          <div className={styles.draftSkeletonBody} />
        </div>
      </div>
    );
  }

  if (lobby.state === "lobby") {
    const seats = lobby.seats?.length
      ? lobby.seats
      : Array.from({ length: ULTIMA_MAX_SEATS }, () => ({ team_name: "Bot", bot: true }));

    return (
      <div className={`${styles.draftRoom} ${styles.draftOffice} ${styles.dLobby} ultima-live-chrome-off`}>
        <header className={styles.dBar}>
          <div className={styles.dBarYou}>
            <p className={styles.dBarClub}>{code}</p>
            <p className={styles.dBarPick}>{lobby.solo ? "Solo" : "Shared"} lobby</p>
          </div>
        </header>

        <UltimaPanel raised title="Seats">
          {seats.map((seat, index) => (
            <UltimaRow
              key={`${seat.team_name}-${index}`}
              primary={`${index + 1}. ${seat.team_name || "Bot"}`}
              meta={seat.bot ? "Bot" : "Club"}
            />
          ))}
        </UltimaPanel>

        <UltimaPanel title="Settings">
          <UltimaRow primary="Rounds" number={String(ULTIMA_DRAFT_ROUNDS)} />
          <UltimaRow primary="Order" meta="Snake" />
          <UltimaRow
            primary="Floor"
            meta={`${ULTIMA_SQUAD_FLOOR_PER_LEAGUE} per country`}
          />
        </UltimaPanel>

        <p className={styles.prShare}>
          Code {code}
          <button
            type="button"
            className={styles.opPanelAction}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(code);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </p>

        {isHost ? (
          <button type="button" className={styles.primaryBtn} onClick={start} disabled={busy}>
            {busy ? "Starting…" : "Start"}
          </button>
        ) : (
          <UltimaStaffMessage
            subject="Waiting for the host"
            body="The host starts the draft. Bots fill empty seats then."
          />
        )}
        {error ? (
          <UltimaStaffMessage
            subject={error}
            actionLabel="Retry"
            onAction={start}
          />
        ) : null}
        <Link href="/ultima/practice" className={styles.opPanelAction}>
          Leave room
        </Link>
      </div>
    );
  }

  return <UltimaDraftRoom managerId={managerId} variant="practice" roomCode={code} />;
}
