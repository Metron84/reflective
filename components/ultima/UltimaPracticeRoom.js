"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  PRACTICE_MIN_SEATS,
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

  const setLobbySettings = useCallback(
    async ({ seatsCap, mySlot }) => {
      if (!isHost) return;
      setBusy(true);
      setError("");
      try {
        const res = await fetch("/api/ultima/practice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "set_lobby", code, seatsCap, mySlot }),
        });
        const data = await res.json();
        if (!res.ok) setError(data.message ?? "Could not update the lobby.");
        else setLobby(data);
      } finally {
        setBusy(false);
      }
    },
    [code, isHost],
  );

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
    const seatsCap = lobby.seatsCap ?? lobby.seats?.length ?? ULTIMA_MAX_SEATS;
    const humanCount = lobby.humans?.length ?? 1;
    const minCap = Math.max(PRACTICE_MIN_SEATS, humanCount);
    const seats = lobby.seats?.length
      ? lobby.seats
      : Array.from({ length: seatsCap }, (_, index) => ({
          slot: index + 1,
          team_name: "Bot",
          bot: true,
        }));

    return (
      <div className={`${styles.draftRoom} ${styles.draftOffice} ${styles.dLobby} ultima-live-chrome-off`}>
        <header className={styles.dBar}>
          <div className={styles.dBarYou}>
            <p className={styles.dBarClub}>{code}</p>
            <p className={styles.dBarPick}>{lobby.solo ? "Solo" : "Shared"} lobby</p>
          </div>
          {isHost ? (
            <button
              type="button"
              className={`${styles.primaryBtn} ${styles.dBarStart}`}
              onClick={start}
              disabled={busy}
            >
              {busy ? "Starting…" : "Start"}
            </button>
          ) : (
            <p className={styles.dBarPick}>Waiting for the host</p>
          )}
        </header>

        <UltimaPanel raised title="Seats">
          <div className={styles.prSeatCap}>
            <span>Clubs</span>
            {isHost ? (
              <button
                type="button"
                className={styles.prSeatBtn}
                onClick={() => setLobbySettings({ seatsCap: seatsCap - 1 })}
                disabled={busy || seatsCap <= minCap}
                aria-label="Fewer clubs"
              >
                −
              </button>
            ) : null}
            <strong>{seatsCap}</strong>
            {isHost ? (
              <button
                type="button"
                className={styles.prSeatBtn}
                onClick={() => setLobbySettings({ seatsCap: seatsCap + 1 })}
                disabled={busy || seatsCap >= ULTIMA_MAX_SEATS}
                aria-label="More clubs"
              >
                +
              </button>
            ) : null}
          </div>
          {seats.map((seat, index) => {
            const slot = seat.slot ?? index + 1;
            const mine = Boolean(seat.managerId && seat.managerId === managerId);
            return (
              <div key={`${slot}-${seat.managerId ?? "bot"}`} className={styles.prSeatLine}>
                <UltimaRow
                  yours={mine}
                  primary={`${slot}. ${seat.team_name || "Bot"}`}
                  meta={mine ? "You" : seat.bot ? "Bot" : "Club"}
                  onClick={
                    isHost && seat.bot && !busy
                      ? () => setLobbySettings({ mySlot: slot })
                      : undefined
                  }
                />
                {isHost && mine ? (
                  <div className={styles.prSeatMove}>
                    <button
                      type="button"
                      className={styles.prSeatBtn}
                      onClick={() => setLobbySettings({ mySlot: slot - 1 })}
                      disabled={busy || slot <= 1}
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      className={styles.prSeatBtn}
                      onClick={() => setLobbySettings({ mySlot: slot + 1 })}
                      disabled={busy || slot >= seatsCap}
                    >
                      Down
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </UltimaPanel>

        <UltimaPanel title="Settings">
          <UltimaRow primary="Rounds" number={String(ULTIMA_DRAFT_ROUNDS)} />
          <UltimaRow primary="Order" meta="Snake. Host order is kept." />
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

        {!isHost ? (
          <UltimaStaffMessage
            subject="Waiting for the host"
            body="The host starts the draft. Bots fill empty seats then."
          />
        ) : null}
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
