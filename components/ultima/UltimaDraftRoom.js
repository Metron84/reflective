"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ULTIMA_LEAGUES,
  ULTIMA_LEAGUE_SHORT,
  ULTIMA_SQUAD_FLOOR_PER_LEAGUE,
  ULTIMA_TIMER_OPTIONS,
  ULTIMA_TOTAL_PICKS,
  formatUltimaTimer,
  ultimaColourHex,
} from "@/lib/ultima/constants";
import { lastPicksNewestFirst } from "@/lib/ultima/draft/last-picks";
import { floorFromState, formatPickDeadline } from "@/lib/ultima/draft/desk";
import { formatGstTime } from "@/lib/ultima/gst";
import UltimaDraftBoard from "./UltimaDraftBoard";
import UltimaDraftClock from "./UltimaDraftClock";
import UltimaDraftPicker from "./UltimaDraftPicker";
import UltimaDraftPicks from "./UltimaDraftPicks";
import { planQueueSave } from "@/lib/ultima/queue-guard";
import UltimaDraftQueue from "./UltimaDraftQueue";
import useUltimaDraftAdvance from "./useUltimaDraftAdvance";
import { fetchRetryOn401 } from "@/lib/ultima/fetch-retry";
import UltimaStaffMessage from "./UltimaStaffMessage";
import styles from "./ultima.module.css";

function viewStorageKey(scope) {
  return `ultima-draft-view:${scope}`;
}

function OverflowIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <circle cx="12" cy="5" r="1.75" fill="currentColor" />
      <circle cx="12" cy="12" r="1.75" fill="currentColor" />
      <circle cx="12" cy="19" r="1.75" fill="currentColor" />
    </svg>
  );
}

export default function UltimaDraftRoom({
  managerId,
  variant = "season",
  roomCode = null,
}) {
  const isPractice = variant === "practice";
  const router = useRouter();
  const exitHref = isPractice ? "/ultima/practice" : "/ultima";
  const [state, setState] = useState(null);
  const seasonLobby = !isPractice && state?.state === "lobby";
  const [startOpen, setStartOpen] = useState(false);
  const [available, setAvailable] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState("players");
  const [menuOpen, setMenuOpen] = useState(false);
  const [exitConfirm, setExitConfirm] = useState(false);
  const [clockOpen, setClockOpen] = useState(true);
  const [openPlayerId, setOpenPlayerId] = useState(null);
  const menuRef = useRef(null);
  const allowLeave = useRef(false);
  const savingRef = useRef(false);
  const stateRef = useRef(null);
  const [resetting, setResetting] = useState(false);
  const [keepBusy, setKeepBusy] = useState(false);
  const [autoBusy, setAutoBusy] = useState(false);
  const [timerBusy, setTimerBusy] = useState(false);
  const [poolLoading, setPoolLoading] = useState(false);
  const [pollAuthLost, setPollAuthLost] = useState(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const fetchState = useCallback(async () => {
    try {
      const url = isPractice
        ? `/api/ultima/practice/state?code=${encodeURIComponent(roomCode)}`
        : "/api/ultima/draft/state";
      const res = await fetchRetryOn401(url);
      setPollAuthLost(res.status === 401);
      const data = await res.json();
      // A poll that lands mid-save would show the old queue; the save sets the new one.
      if (res.ok && !savingRef.current) setState(data);
    } catch {
      /* reconnect silently */
    }
  }, [isPractice, roomCode]);

  const fetchAvailable = useCallback(async () => {
    setPoolLoading(true);
    try {
      const url = isPractice
        ? `/api/ultima/practice/available?code=${encodeURIComponent(roomCode)}`
        : "/api/ultima/draft/available";
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) setAvailable(data.available ?? []);
    } catch {
      /* keep the last list */
    } finally {
      setPoolLoading(false);
    }
  }, [isPractice, roomCode]);

  const { humanSeconds, stall, authLost, retry } = useUltimaDraftAdvance({
    enabled: Boolean(state) && state.state === "live",
    isPractice,
    roomCode,
    state,
    fetchState,
  });

  useEffect(() => {
    fetchState();
    const streamUrl = isPractice
      ? `/api/ultima/stream?scope=${encodeURIComponent(`practice:${roomCode}`)}`
      : "/api/ultima/stream";
    const es = new EventSource(streamUrl);
    es.addEventListener("draft.pick", fetchState);
    es.addEventListener("draft.state", fetchState);
    es.addEventListener("draft.tick", fetchState);
    return () => {
      es.close();
    };
  }, [fetchState, isPractice, roomCode]);

  useEffect(() => {
    const poll = setInterval(fetchState, isPractice ? 2000 : 5000);
    return () => clearInterval(poll);
  }, [fetchState, isPractice]);

  const viewScope = isPractice ? roomCode : managerId;

  useEffect(() => {
    if (!viewScope || typeof window === "undefined") return;
    try {
      const stored = sessionStorage.getItem(viewStorageKey(viewScope));
      if (stored === "desk" || stored === "players") setViewMode("players");
      else if (stored === "queue" || stored === "picks" || stored === "board") {
        setViewMode(stored);
      }
    } catch {
      /* private mode */
    }
  }, [viewScope]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    function onKey(event) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    function onPointer(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [menuOpen]);

  const leaveRoom = useCallback(() => {
    allowLeave.current = true;
    setExitConfirm(false);
    router.push(exitHref);
  }, [exitHref, router]);

  const requestExit = useCallback(() => {
    if (isPractice) {
      leaveRoom();
      return;
    }
    if (state?.state === "live") {
      setExitConfirm(true);
      return;
    }
    leaveRoom();
  }, [isPractice, leaveRoom, state?.state]);

  useEffect(() => {
    if (isPractice || state?.state !== "live") return undefined;
    const marker = { ultimaDraftGuard: true };
    window.history.pushState(marker, "");

    function onPopState() {
      if (allowLeave.current) return;
      window.history.pushState(marker, "");
      setExitConfirm(true);
    }

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [isPractice, state?.state]);

  useEffect(() => {
    if (!exitConfirm) return undefined;
    function onKey(event) {
      if (event.key === "Escape") setExitConfirm(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exitConfirm]);

  useEffect(() => {
    if (state?.state !== "live" && state?.state !== "paused" && !seasonLobby) return;
    if (available.length) return;
    fetchAvailable();
  }, [available.length, fetchAvailable, seasonLobby, state?.state]);

  useEffect(() => {
    if (state?.is_your_turn && !state.auto_draft) setClockOpen(true);
  }, [state?.is_your_turn, state?.auto_draft, state?.current_pick]);

  const draftedIds = useMemo(
    () => new Set((state?.picks ?? []).map((p) => p.player?.id).filter(Boolean)),
    [state?.picks],
  );

  const pool = useMemo(
    () => available.filter((p) => !draftedIds.has(p.id)),
    [available, draftedIds],
  );

  const byId = useMemo(() => {
    const map = new Map();
    for (const p of pool) map.set(p.id, p);
    return map;
  }, [pool]);

  async function forcePickPlayer(playerId) {
    if (isPractice || !state?.is_commissioner) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ultima/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "force_pick", player_id: playerId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Force pick failed.");
      } else {
        await fetchState();
      }
    } catch {
      setError("Connection lost. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function draftPlayer(playerId) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(isPractice ? "/api/ultima/practice/pick" : "/api/ultima/draft/pick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isPractice ? { player_id: playerId, code: roomCode } : { player_id: playerId },
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, message: data.message ?? "Pick failed." };
      }
      setOpenPlayerId(null);
      await fetchState();
      return { ok: true };
    } catch {
      return { ok: false, message: "Connection lost. Try again." };
    } finally {
      setLoading(false);
    }
  }

  // The queue is only editable once the saved one has loaded, and every save names
  // the queue it was based on, so a stale tab cannot overwrite a newer one.
  async function saveQueue(playerIds, { cleared = false } = {}) {
    const plan = planQueueSave(stateRef.current?.queue, playerIds, { cleared });
    if (!plan || savingRef.current) return;
    setError("");
    savingRef.current = true;
    try {
      const res = await fetch(isPractice ? "/api/ultima/practice/queue" : "/api/ultima/draft/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isPractice ? { ...plan, code: roomCode } : plan),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setState((prev) =>
          prev
            ? { ...prev, queue: playerIds.map((player_id, i) => ({ player_id, position: i + 1 })) }
            : prev,
        );
      } else if (data.code === "QUEUE_CONFLICT") {
        setState((prev) => (prev ? { ...prev, queue: data.queue ?? [] } : prev));
        setError("Your queue changed on another device. Reloaded.");
      } else {
        setError(data.message ?? "The queue did not save. Try again.");
      }
    } catch {
      setError("Connection lost. The queue did not save.");
    } finally {
      savingRef.current = false;
    }
    fetchState();
  }

  async function queuePlayer(playerId) {
    if (!Array.isArray(state?.queue)) return;
    const current = state.queue.map((q) => q.player_id);
    if (current.includes(playerId)) return;
    await saveQueue([...current, playerId]);
  }

  async function unqueuePlayer(playerId) {
    if (!Array.isArray(state?.queue)) return;
    const current = state.queue.map((q) => q.player_id);
    await saveQueue(
      current.filter((id) => id !== playerId),
      { cleared: true },
    );
  }

  async function toggleAutoDraft() {
    setAutoBusy(true);
    setError("");
    try {
      const res = await fetch(isPractice ? "/api/ultima/practice" : "/api/ultima/draft/auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isPractice
            ? { action: "auto_draft", code: roomCode, enabled: !state.auto_draft }
            : { enabled: !state.auto_draft },
        ),
      });
      const data = await res.json();
      if (!res.ok) setError(data.message ?? "Could not update auto-draft.");
      await fetchState();
    } catch {
      setError("Connection lost. Try again.");
    } finally {
      setAutoBusy(false);
    }
  }

  async function setLiveTimer(seconds) {
    if (isPractice || !state.is_commissioner) return;
    setTimerBusy(true);
    setError("");
    try {
      const res = await fetch("/api/ultima/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_timer", timer_seconds: seconds }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.message ?? "Could not change the clock.");
      await fetchState();
    } catch {
      setError("Connection lost. Try again.");
    } finally {
      setTimerBusy(false);
    }
  }

  async function pauseOrResume() {
    if (isPractice || !state.is_commissioner) return;
    const action = state.state === "paused" ? "resume_draft" : "pause_draft";
    setTimerBusy(true);
    setError("");
    try {
      const res = await fetch("/api/ultima/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.message ?? "Could not update the draft.");
      await fetchState();
    } catch {
      setError("Connection lost. Try again.");
    } finally {
      setTimerBusy(false);
    }
  }

  async function resetPractice() {
    if (!isPractice || !state?.is_host) return;
    setResetting(true);
    try {
      await fetch("/api/ultima/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset", code: roomCode }),
      });
      await fetchState();
    } finally {
      setResetting(false);
    }
  }

  async function toggleKeep() {
    if (!isPractice || !state?.is_host) return;
    setKeepBusy(true);
    try {
      await fetch("/api/ultima/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: state.keep ? "forget" : "save",
          code: roomCode,
        }),
      });
      await fetchState();
    } finally {
      setKeepBusy(false);
    }
  }

  if (!state) {
    return (
      <div className={`${styles.draftRoom} ${styles.draftOffice} ultima-live-chrome-off`}>
        <div className={styles.draftSkeleton} aria-busy="true" aria-label="Loading draft room">
          <div className={styles.draftSkeletonBar} />
          <div className={styles.draftSkeletonChip} />
          <div className={styles.draftSkeletonBody} />
        </div>
      </div>
    );
  }

  if (state.state === "lobby" && !seasonLobby) {
    return (
      <div className={`${styles.draftRoom} ${styles.draftOffice} ${styles.dLobby} ultima-live-chrome-off`}>
        <UltimaStaffMessage
          subject={isPractice ? "Practice lobby" : "Draft lobby"}
          body={
            isPractice
              ? "Waiting for the host to start."
              : "Waiting for the commissioner to start."
          }
          actionLabel="Exit"
          onAction={leaveRoom}
        />
      </div>
    );
  }

  if (state.state === "complete") {
    return (
      <div className={`${styles.draftRoom} ${styles.draftOffice} ${styles.dLobby} ultima-live-chrome-off`}>
        <UltimaStaffMessage
          subject={isPractice ? "Practice complete" : "Draft complete"}
          body={
            isPractice
              ? "Practice complete. Picks do not count toward the league."
              : "Draft complete. Set your XV."
          }
          actionLabel={isPractice ? "Practice lobby" : "Set your XV"}
          href={isPractice ? "/ultima/practice" : "/ultima/squad"}
        />
        <UltimaDraftBoard managers={state.managers ?? []} picks={state.picks ?? []} youId={managerId} />
        {isPractice && state.is_host ? (
          <div className={styles.dCompleteActions}>
            <button type="button" className={styles.primaryBtn} onClick={toggleKeep} disabled={keepBusy}>
              {keepBusy ? "Saving…" : state.keep ? "Saved. Tap to forget" : "Save board"}
            </button>
            <button type="button" className={styles.secondaryBtn} onClick={resetPractice} disabled={resetting}>
              {resetting ? "Resetting…" : "Reset practice"}
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  const canForcePick =
    !isPractice &&
    state.is_commissioner &&
    state.state === "live" &&
    state.on_clock &&
    !state.on_clock.is_you;

  const floor = floorFromState(state);
  const you = (state.managers ?? []).find((m) => m.id === managerId);
  const onClockSeat = (state.managers ?? []).find((m) => m.id === state.on_clock?.id);
  const seats = state.managers?.length || 10;
  const totalPicks = seats * 30 || ULTIMA_TOTAL_PICKS;
  const round = Math.max(1, Math.ceil((state.current_pick || 1) / seats));
  const yourTurn = !seasonLobby && Boolean(state.is_your_turn);
  const showClock = yourTurn && state.state === "live" && !state.auto_draft && clockOpen;
  const lastPick = lastPicksNewestFirst(state.picks ?? [], 1)[0];
  const ticker =
    lastPick?.player && (lastPick.is_bot || lastPick.auto_picked)
      ? `${lastPick.manager_name} took ${lastPick.player.name} (${ULTIMA_LEAGUE_SHORT[lastPick.player.league] ?? lastPick.player.league})`
      : null;

  function chooseView(next) {
    setViewMode(next);
    if (!viewScope) return;
    try {
      sessionStorage.setItem(viewStorageKey(viewScope), next);
    } catch {
      /* private mode */
    }
  }

  function moveQueue(index, dir) {
    if (!Array.isArray(state?.queue)) return;
    const ids = state.queue.map((q) => q.player_id);
    const next = index + dir;
    if (next < 0 || next >= ids.length) return;
    const copy = [...ids];
    const [item] = copy.splice(index, 1);
    copy.splice(next, 0, item);
    saveQueue(copy);
  }

  const shownView = seasonLobby && viewMode === "board" ? "players" : viewMode;

  async function startSeasonDraft() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ultima/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start_draft" }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.message ?? "The draft could not start.");
      setStartOpen(false);
      await fetchState();
    } catch {
      setError("Connection lost.");
    } finally {
      setLoading(false);
    }
  }

  const deadline = yourTurn
    ? formatPickDeadline(
        state.turn_expires_at,
        state.timer_seconds,
        humanSeconds ?? state.seconds_remaining,
      )
    : null;
  const timerLabel =
    deadline ||
    (state.timer_seconds && (humanSeconds != null || state.seconds_remaining != null)
      ? String(humanSeconds ?? state.seconds_remaining)
      : null);

  const queuePane = (
    <UltimaDraftQueue
      queue={state.queue ?? []}
      byId={byId}
      draftedIds={draftedIds}
      floor={floor}
      onMove={moveQueue}
      onRemove={unqueuePlayer}
      onDraft={draftPlayer}
      isYourTurn={yourTurn}
      pickBusy={loading}
    />
  );

  const picksPane = (
    <UltimaDraftPicks picks={state.picks ?? []} youId={managerId} floor={floor} />
  );

  const pickerPane = (
    <UltimaDraftPicker
      available={pool}
      queue={state.queue ?? []}
      loadingPool={poolLoading}
      isYourTurn={yourTurn}
      canForcePick={canForcePick}
      pickBusy={loading}
      floor={floor}
      openPlayerId={openPlayerId}
      onOpenPlayer={setOpenPlayerId}
      onClosePlayer={() => setOpenPlayerId(null)}
      onDraft={draftPlayer}
      onForce={forcePickPlayer}
      onQueue={queuePlayer}
      onUnqueue={unqueuePlayer}
    />
  );

  return (
    <div
      className={`${styles.draftRoom} ${styles.draftOffice} ultima-live-chrome-off`}
      style={you?.colour ? { "--team": ultimaColourHex(you.colour) } : undefined}
    >
      <header className={styles.dBar}>
        <div className={styles.dBarYou}>
          <p className={styles.dBarClub}>{you?.team_name || "Ultima"}</p>
          <p className={styles.dBarPick}>
            {seasonLobby
              ? "Draft lobby"
              : `Round ${round} · Pick ${state.current_pick ?? "-"} of ${totalPicks}`}
          </p>
        </div>
        <div
          className={styles.dBarTurn}
          style={
            onClockSeat?.colour
              ? { "--onclock": ultimaColourHex(onClockSeat.colour) }
              : undefined
          }
        >
          <p className={styles.dBarTurnName}>
            {seasonLobby ? "Waiting for the commissioner" : state.on_clock?.team_name || "Waiting"}
          </p>
          {!seasonLobby && timerLabel ? <p className={styles.dBarTimer}>{timerLabel}</p> : null}
        </div>
        <div className={styles.dBarRight}>
          <button
            type="button"
            className={state.auto_draft ? styles.dAutoOn : styles.dAutoOff}
            onClick={toggleAutoDraft}
            disabled={autoBusy}
          >
            {autoBusy ? "…" : "Auto"}
          </button>
          <div className={styles.draftMenuWrap} ref={menuRef}>
            <button
              type="button"
              className={styles.dMenuBtn}
              aria-label="Draft menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <OverflowIcon />
            </button>
            {menuOpen ? (
              <div className={styles.dMenu} role="menu">
                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); requestExit(); }}>
                  Exit
                </button>
                {!isPractice && state.is_commissioner && !seasonLobby ? (
                  <>
                    <button type="button" role="menuitem" disabled={timerBusy} onClick={() => { pauseOrResume(); setMenuOpen(false); }}>
                      {state.state === "paused" ? "Resume" : "Pause"}
                    </button>
                    {state.timer_tiered ? (
                      <p role="note">{state.timer_schedule}</p>
                    ) : (
                      ULTIMA_TIMER_OPTIONS.map((seconds) => (
                        <button
                          key={seconds}
                          type="button"
                          role="menuitem"
                          disabled={timerBusy}
                          onClick={() => { setLiveTimer(seconds); setMenuOpen(false); }}
                        >
                          {formatUltimaTimer(seconds)}
                        </button>
                      ))
                    )}
                  </>
                ) : null}
                {isPractice && state.is_host ? (
                  <>
                    <button type="button" role="menuitem" disabled={keepBusy} onClick={() => { toggleKeep(); setMenuOpen(false); }}>
                      {keepBusy ? "…" : state.keep ? "Saved" : "Save"}
                    </button>
                    <button type="button" role="menuitem" disabled={resetting} onClick={() => { resetPractice(); setMenuOpen(false); }}>
                      {resetting ? "…" : "Reset"}
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
        <div className={styles.dFloor} aria-label="League floor">
          {ULTIMA_LEAGUES.map((id) => {
            const count = floor.counts?.[id] ?? 0;
            const met = count >= ULTIMA_SQUAD_FLOOR_PER_LEAGUE;
            return (
              <span key={id} className={met ? styles.dFloorMet : styles.dFloorNeed}>
                {ULTIMA_LEAGUE_SHORT[id]} {count}/{ULTIMA_SQUAD_FLOOR_PER_LEAGUE}
              </span>
            );
          })}
        </div>
      </header>

      {ticker ? <p className={styles.dTicker}>{ticker}</p> : null}

      {seasonLobby ? (
        <UltimaStaffMessage
          subject="Waiting for the commissioner to start."
          body={`${
            state.scheduled_at ? `Scheduled ${formatGstTime(state.scheduled_at)} GST. ` : ""
          }The draft order follows seat order. Build your queue now.`}
          actionLabel={state.is_commissioner ? "Start draft" : undefined}
          onAction={state.is_commissioner ? () => setStartOpen(true) : undefined}
        />
      ) : null}

      {startOpen ? (
        <div className={styles.dSheet} role="dialog" aria-modal="true" aria-label="Start the draft">
          <button
            type="button"
            className={styles.dSheetBackdrop}
            aria-label="Cancel"
            onClick={() => !loading && setStartOpen(false)}
          />
          <div className={styles.dSheetPanel}>
            <p className={styles.dSheetName}>Start the draft now?</p>
            <p className={styles.dSheetMeta}>The order is locked. Pick 1 begins.</p>
            <div className={styles.dSheetActions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                disabled={loading}
                onClick={() => setStartOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={loading}
                onClick={startSeasonDraft}
              >
                {loading ? "Starting…" : "Start draft"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <nav className={styles.dTabs} aria-label="Draft views">
        {[
          ["players", "Players"],
          ["queue", "Queue"],
          ["picks", "Picks"],
          ["board", "Board"],
        ]
          .filter(([id]) => !(seasonLobby && id === "board"))
          .map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={shownView === id ? styles.dTabOn : styles.dTab}
            onClick={() => chooseView(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {authLost || pollAuthLost ? (
        <UltimaStaffMessage
          subject="Connection lost"
          body="Connection lost, refresh."
          actionLabel="Refresh"
          onAction={() => window.location.reload()}
        />
      ) : null}

      {stall && !(authLost || pollAuthLost) ? (
        <UltimaStaffMessage
          subject="The draft paused"
          body="The draft paused. Retry to resume."
          actionLabel="Retry"
          onAction={retry}
        />
      ) : null}

      {state.state === "paused" ? (
        <UltimaStaffMessage
          subject="Paused"
          body="The commissioner paused the draft."
        />
      ) : null}

      {error ? (
        <UltimaStaffMessage subject="The office could not complete that" body={error} />
      ) : null}

      <div className={styles.dStage}>
        {shownView === "players" ? (
          <div className={styles.dSplit}>
            <div className={styles.dSplitMain}>{pickerPane}</div>
            <div className={styles.dSplitSide}>
              <section className={styles.opPanel} aria-label="Queue">
                <header className={styles.opPanelHead}>
                  <h2 className={styles.opPanelTitle}>Queue</h2>
                </header>
                {queuePane}
              </section>
              <section className={styles.opPanel} aria-label="Your picks">
                <header className={styles.opPanelHead}>
                  <h2 className={styles.opPanelTitle}>Your picks</h2>
                </header>
                {picksPane}
              </section>
            </div>
          </div>
        ) : null}
        {shownView === "queue" ? queuePane : null}
        {shownView === "picks" ? picksPane : null}
        {shownView === "board" ? (
          <UltimaDraftBoard
            managers={state.managers ?? []}
            picks={state.picks ?? []}
            currentPick={state.current_pick}
            youId={managerId}
          />
        ) : null}
      </div>

      {showClock ? (
        <UltimaDraftClock
          round={round}
          pickNumber={state.current_pick}
          pool={pool}
          queue={state.queue ?? []}
          byId={byId}
          floor={floor}
          schedule={state.timer_schedule}
          pickBusy={loading}
          onDraft={draftPlayer}
          onSeeAll={() => {
            setClockOpen(false);
            chooseView("players");
          }}
          onAutoPick={draftPlayer}
        />
      ) : null}

      {exitConfirm ? (
        <div className={styles.dSheet} role="dialog" aria-modal="true">
          <button
            type="button"
            className={styles.dSheetBackdrop}
            aria-label="Stay"
            onClick={() => setExitConfirm(false)}
          />
          <div className={styles.dSheetPanel}>
            <p className={styles.dSheetName}>Leave the draft room?</p>
            <p className={styles.dSheetMeta}>Your clock keeps running.</p>
            <div className={styles.dSheetActions}>
              <button type="button" className={styles.secondaryBtn} onClick={() => setExitConfirm(false)}>
                Stay
              </button>
              <button type="button" className={styles.primaryBtn} onClick={leaveRoom}>
                Leave
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
