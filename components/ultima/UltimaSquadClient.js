"use client";

import { useState } from "react";
import {
  ULTIMA_LEAGUES,
  ULTIMA_LEAGUE_SHORT,
  ULTIMA_XI_FLOOR_PER_LEAGUE,
  ULTIMA_XI_SIZE,
} from "@/lib/ultima/constants";
import styles from "./ultima.module.css";

export default function UltimaSquadClient({
  roster,
  lineup: initialLineup,
  gameweek,
  lockedLeagues,
}) {
  const [tab, setTab] = useState("xi");
  const [lineup, setLineup] = useState(initialLineup);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sheetSlot, setSheetSlot] = useState(null);

  const rosterById = new Map(roster.map((p) => [p.id, p]));
  const inXi = new Set(lineup.filter((r) => r.player_id).map((r) => r.player_id));

  function floorLabel() {
    const counts = Object.fromEntries(ULTIMA_LEAGUES.map((l) => [l, 0]));
    for (const row of lineup) {
      if (!row.player_id) continue;
      counts[row.slot_group] = (counts[row.slot_group] ?? 0) + 1;
    }
    return ULTIMA_LEAGUES.map(
      (l) => `${ULTIMA_LEAGUE_SHORT[l]} ${counts[l]}/${ULTIMA_XI_FLOOR_PER_LEAGUE}`,
    ).join(" · ");
  }

  function benchForSlot(slot) {
    const row = lineup.find((r) => r.slot === slot);
    if (!row) return bench;
    return bench.filter((p) => p.league === row.slot_group);
  }

  function assignSlot(slot, playerId) {
    setLineup((prev) =>
      prev.map((r) => (r.slot === slot ? { ...r, player_id: playerId } : r)),
    );
    setSheetSlot(null);
  }

  async function saveXi() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/ultima/lineup/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots: lineup }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Could not save.");
      } else {
        setMessage("XI saved.");
      }
    } catch {
      setError("Connection lost. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const bench = roster.filter((p) => !inXi.has(p.id));

  return (
    <div className={styles.squadPage}>
      <div className={styles.squadHeader}>
        <p className={styles.floorLine}>{floorLabel()}</p>
        <div className={styles.squadTabs}>
          <button
            type="button"
            className={tab === "xi" ? styles.tabActiveCream : styles.tabCream}
            onClick={() => setTab("xi")}
          >
            XI
          </button>
          <button
            type="button"
            className={tab === "squad" ? styles.tabActiveCream : styles.tabCream}
            onClick={() => setTab("squad")}
          >
            Squad
          </button>
        </div>
      </div>

      {gameweek?.state === "live" || gameweek?.state === "provisional" ? (
        <div className={styles.liveStrip}>
          <span>Provisional</span>
        </div>
      ) : null}

      {tab === "xi" ? (
        <ul className={styles.xiList}>
          {lineup.map((row) => {
            const player = row.player_id ? rosterById.get(row.player_id) : null;
            const locked = player && lockedLeagues.includes(player.league);
            return (
              <li
                key={row.slot}
                className={locked ? styles.xiRowLocked : styles.xiRow}
              >
                <button
                  type="button"
                  className={styles.xiSlotBtn}
                  disabled={locked}
                  onClick={() => setSheetSlot(row.slot)}
                >
                  <span className={styles.xiSlotLabel}>
                    {ULTIMA_LEAGUE_SHORT[row.slot_group] ?? row.slot_group}
                  </span>
                  <span>{player ? player.name : "Empty"}</span>
                  {locked ? <span className={styles.lockIcon}>🔒</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className={styles.squadList}>
          {roster.map((p) => (
            <li key={p.id} className={styles.squadRow}>
              <div>
                <strong>{p.name}</strong>
                <span className={styles.playerMeta}>
                  {p.club} · {p.league}
                  {p.bolt_eligible ? " · Bolt" : ""}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {error ? <p className={styles.messageError}>{error}</p> : null}
      {message ? <p className={styles.messageOk}>{message}</p> : null}

      {tab === "xi" ? (
        <>
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={saving}
            onClick={saveXi}
          >
            Save XI
          </button>
          <p className={styles.disabledReason}>
            {lineup.filter((r) => r.player_id).length < ULTIMA_XI_SIZE
              ? `Fill all ${ULTIMA_XI_SIZE} slots to save.`
              : ""}
          </p>
        </>
      ) : null}

      {sheetSlot != null ? (
        <div className={styles.sheetBackdrop} onClick={() => setSheetSlot(null)}>
          <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
            <p className={styles.sheetTitle}>Pick a player</p>
            <ul>
              {benchForSlot(sheetSlot).map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className={styles.sheetRow}
                    onClick={() => assignSlot(sheetSlot, p.id)}
                  >
                    {p.name} · {p.club}
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className={styles.quietLink} onClick={() => setSheetSlot(null)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
