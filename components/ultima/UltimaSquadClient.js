"use client";

import { Bebas_Neue } from "next/font/google";
import { useMemo, useState } from "react";
import {
  ULTIMA_LEAGUES,
  ULTIMA_LEAGUE_SHORT,
  ULTIMA_XI_FLOOR_PER_LEAGUE,
  ULTIMA_XI_SIZE,
  leagueLabel,
} from "@/lib/ultima/constants";
import { validateXiFloors } from "@/lib/ultima/lineup/slots";
import styles from "./ultima.module.css";

const bebas = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
});

function Padlock() {
  return (
    <svg className={styles.lockGlyph} viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        d="M8 11V8a4 4 0 0 1 8 0v3M7 11h10v10H7z"
      />
    </svg>
  );
}

function lastPoints(player) {
  if (player?.last_gw_points != null) return player.last_gw_points;
  return "—";
}

function ppg(player) {
  const n = Number(player?.points_per_game);
  if (Number.isFinite(n) && n > 0) return n.toFixed(2);
  return null;
}

export default function UltimaSquadClient({
  roster,
  lineup: initialLineup,
  gameweek,
  lockedLeagues = [],
  liveTotal = null,
  preview = false,
  startView = "xv",
  openSheetOnMount = false,
}) {
  const [view, setView] = useState(startView === "all30" ? "all30" : "xv");
  const [lineup, setLineup] = useState(initialLineup);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sheetSlot, setSheetSlot] = useState(() => {
    if (!openSheetOnMount) return null;
    const empty = initialLineup.find((r) => !r.player_id);
    return empty?.slot ?? null;
  });
  const [menuId, setMenuId] = useState(null);

  const rosterById = useMemo(() => new Map(roster.map((p) => [p.id, p])), [roster]);
  const inXv = useMemo(
    () => new Set(lineup.filter((r) => r.player_id).map((r) => r.player_id)),
    [lineup],
  );
  const bench = useMemo(
    () => roster.filter((p) => !inXv.has(p.id)),
    [roster, inXv],
  );

  const counts = useMemo(() => {
    const next = Object.fromEntries(ULTIMA_LEAGUES.map((l) => [l, 0]));
    for (const row of lineup) {
      if (!row.player_id) continue;
      next[row.slot_group] = (next[row.slot_group] ?? 0) + 1;
    }
    return next;
  }, [lineup]);

  const floorCheck = useMemo(
    () => validateXiFloors(lineup, rosterById),
    [lineup, rosterById],
  );
  const filled = lineup.filter((r) => r.player_id).length;
  const allLocked = ULTIMA_LEAGUES.every((l) => lockedLeagues.includes(l));
  const firstOpen = ULTIMA_LEAGUES.find((l) => !lockedLeagues.includes(l));
  const live =
    gameweek?.state === "live" || gameweek?.state === "provisional";
  const canSave =
    view === "xv" &&
    !allLocked &&
    filled === ULTIMA_XI_SIZE &&
    floorCheck.ok &&
    !saving;
  const saveReason = allLocked
    ? ""
    : floorCheck.missing?.length
      ? floorCheck.reason
      : filled < ULTIMA_XI_SIZE
        ? `Fill all ${ULTIMA_XI_SIZE} slots to save.`
        : "";
  const saveHint = canSave ? "Your XV is ready." : saveReason;
  const dirty = JSON.stringify(lineup) !== JSON.stringify(initialLineup);

  const kicker = allLocked
    ? "Your XV is locked."
    : live && firstOpen
      ? `${leagueLabel(firstOpen)} stays editable.`
      : "Set your XV. Three from each league.";

  function benchForSlot(slot) {
    const row = lineup.find((r) => r.slot === slot);
    if (!row) return [];
    return [...bench]
      .filter((p) => p.league === row.slot_group)
      .sort((a, b) => Number(b.points_per_game ?? 0) - Number(a.points_per_game ?? 0));
  }

  function assignSlot(slot, playerId) {
    setLineup((prev) =>
      prev.map((r) => (r.slot === slot ? { ...r, player_id: playerId } : r)),
    );
    setSheetSlot(null);
  }

  function moveToXv(player) {
    const empty = lineup.find(
      (r) => r.slot_group === player.league && !r.player_id,
    );
    if (!empty) return;
    if (lockedLeagues.includes(player.league)) return;
    assignSlot(empty.slot, player.id);
    setMenuId(null);
    setView("xv");
  }

  async function saveXv() {
    if (!canSave) return;
    if (preview) {
      setMessage("SAMPLE. Not saved.");
      return;
    }
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
        setMessage("XV saved.");
      }
    } catch {
      setError("Connection lost. Try again.");
    } finally {
      setSaving(false);
    }
  }

  function resetLineup() {
    setLineup(initialLineup);
    setMessage("");
    setError("");
  }

  const groups = ULTIMA_LEAGUES.map((league) => ({
    league,
    locked: lockedLeagues.includes(league),
    count: counts[league] ?? 0,
    rows: lineup.filter((r) => r.slot_group === league),
  }));

  const rosterGroups = ULTIMA_LEAGUES.map((league) => ({
    league,
    players: roster.filter((p) => p.league === league),
  }));

  const sheetRow = sheetSlot != null ? lineup.find((r) => r.slot === sheetSlot) : null;
  const sheetPlayer = sheetRow?.player_id ? rosterById.get(sheetRow.player_id) : null;
  const sheetLeague = sheetRow ? leagueLabel(sheetRow.slot_group) : "";

  const showSave = view === "xv" && !allLocked;

  return (
    <div className={`${styles.squadPage} ${showSave ? styles.squadPageSavePad : ""}`}>
      <header className={styles.ledgerHead}>
        <div className={styles.ledgerHeadRow}>
          <h1 className={styles.ledgerTitle}>My squad</h1>
          {view === "xv" ? (
            <button
              type="button"
              className={styles.ledgerAll}
              onClick={() => setView("all30")}
            >
              All 30
            </button>
          ) : (
            <button
              type="button"
              className={styles.ledgerAll}
              onClick={() => setView("xv")}
            >
              Back to XV
            </button>
          )}
        </div>
        {gameweek?.number ? (
          <p className={styles.ledgerGw}>Gameweek {gameweek.number}</p>
        ) : null}
        {live ? (
          <div className={styles.liveStrip}>
            <span className={`${styles.liveTotal} ${bebas.className}`}>
              {liveTotal != null ? liveTotal : "—"}
            </span>
            <span>Provisional</span>
          </div>
        ) : null}
      </header>

      {view === "xv" ? (
        <>
          <p className={styles.ledgerCount}>
            XV of {ULTIMA_XI_SIZE}
            <span>{filled}</span>
          </p>
          <p className={styles.ledgerKicker}>{kicker}</p>

          <div className={styles.xvGroups}>
            {groups.map((group) => {
              const short = group.count < ULTIMA_XI_FLOOR_PER_LEAGUE;
              return (
                <section
                  key={group.league}
                  className={group.locked ? styles.xvGroupLocked : styles.xvGroup}
                >
                  <header className={styles.xvGroupHead}>
                    <h2 className={styles.xvGroupName}>{leagueLabel(group.league)}</h2>
                    <p className={styles.xvGroupCount}>
                      {group.count} of {ULTIMA_XI_FLOOR_PER_LEAGUE}
                    </p>
                  </header>
                  <p className={styles.xvGroupNote}>
                    {group.locked
                      ? `${leagueLabel(group.league)} is live.`
                      : short
                        ? `One more from ${leagueLabel(group.league)}.`
                        : ""}
                  </p>
                  <ul className={styles.xiList}>
                    {group.rows.map((row) => {
                      const player = row.player_id ? rosterById.get(row.player_id) : null;
                      const empty = !player;
                      return (
                        <li
                          key={row.slot}
                          className={empty ? styles.xiRowEmpty : styles.xiRow}
                        >
                          <button
                            type="button"
                            className={empty ? styles.xiSlotEmpty : styles.xiSlotBtn}
                            disabled={group.locked}
                            onClick={() => setSheetSlot(row.slot)}
                          >
                            {empty ? (
                              <span className={styles.xiChoose}>+ Choose a player</span>
                            ) : (
                              <>
                                <span className={styles.xiSlotLabel}>
                                  {ULTIMA_LEAGUE_SHORT[row.slot_group] ?? row.slot_group}
                                </span>
                                <span className={styles.xiSlotMain}>
                                  <span className={styles.xiSlotName}>{player.name}</span>
                                  <span className={styles.xiSlotMeta}>
                                    {player.club} · {ULTIMA_LEAGUE_SHORT[player.league]}
                                    {row.auto_started ? " · Auto" : ""}
                                  </span>
                                </span>
                                <span className={styles.xiSlotPts}>{lastPoints(player)}</span>
                              </>
                            )}
                            {group.locked ? <Padlock /> : null}
                          </button>
                          {row.auto_started && !empty ? (
                            <p className={styles.xiAuto}>This slot started automatically.</p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                  {group.locked ? <p className={styles.xvLockedLabel}>Locked</p> : null}
                </section>
              );
            })}
          </div>
        </>
      ) : (
        <div className={styles.xvGroups}>
          {rosterGroups.map((group) => (
            <section key={group.league} className={styles.xvGroup}>
              <header className={styles.xvGroupHead}>
                <h2 className={styles.xvGroupName}>{leagueLabel(group.league)}</h2>
                <p className={styles.xvGroupCount}>
                  {group.players.length} / {ULTIMA_XI_FLOOR_PER_LEAGUE} floor
                </p>
              </header>
              <ul className={styles.squadList}>
                {group.players.map((p) => (
                  <li key={p.id} className={styles.squadRow}>
                    <div className={styles.squadRowMain}>
                      <strong>{p.name}</strong>
                      <span className={styles.playerMeta}>
                        {p.club} · {ULTIMA_LEAGUE_SHORT[p.league]} · {p.season_points ?? 0} pts
                        {p.next_fixture ? ` · ${p.next_fixture}` : ""}
                        {p.bolt_eligible ? " · Bolt" : ""}
                        {inXv.has(p.id) ? " · XV" : ""}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={styles.squadMenuBtn}
                      aria-label={`Actions for ${p.name}`}
                      aria-expanded={menuId === p.id}
                      onClick={() => setMenuId((id) => (id === p.id ? null : p.id))}
                    >
                      ···
                    </button>
                    {menuId === p.id ? (
                      <div className={styles.squadMenu} role="menu">
                        <button
                          type="button"
                          className={styles.squadMenuItem}
                          role="menuitem"
                          disabled={
                            lockedLeagues.includes(p.league) ||
                            inXv.has(p.id) ||
                            !lineup.some((r) => r.slot_group === p.league && !r.player_id)
                          }
                          onClick={() => moveToXv(p)}
                        >
                          Move to XV
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {error ? <p className={styles.messageError}>{error}</p> : null}
      {message ? <p className={styles.messageOk}>{message}</p> : null}

      {showSave ? (
        <div className={styles.saveBar}>
          {saveHint ? <p className={styles.saveReason}>{saveHint}</p> : null}
          <div className={styles.saveBarRow}>
            {dirty ? (
              <button type="button" className={styles.saveReset} onClick={resetLineup}>
                Reset
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              className={canSave ? styles.saveXv : styles.saveXvOff}
              disabled={!canSave}
              onClick={saveXv}
            >
              {saving ? "Saving…" : "Save XV"}
            </button>
          </div>
        </div>
      ) : null}

      {sheetSlot != null ? (
        <div className={styles.sheetBackdrop} onClick={() => setSheetSlot(null)}>
          <div
            className={styles.sheet}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className={styles.sheetHead}>
              <p className={styles.sheetTitle}>{sheetLeague} bench</p>
              <button type="button" className={styles.quietLink} onClick={() => setSheetSlot(null)}>
                Close
              </button>
            </div>
            <p className={styles.sheetKicker}>
              {sheetPlayer ? `Replace ${sheetPlayer.name}` : "Choose a player"}
            </p>
            <ul className={styles.sheetList}>
              {benchForSlot(sheetSlot).map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className={styles.sheetRow}
                    onClick={() => assignSlot(sheetSlot, p.id)}
                  >
                    <span className={styles.sheetRowMain}>
                      <span className={styles.xiSlotName}>{p.name}</span>
                      <span className={styles.xiSlotMeta}>
                        {p.club} · {ULTIMA_LEAGUE_SHORT[p.league]}
                        {ppg(p) ? ` · ${ppg(p)} PPG` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {!benchForSlot(sheetSlot).length ? (
              <p className={styles.disabledReason}>No eligible bench players for this slot.</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
