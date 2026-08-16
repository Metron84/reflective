"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ULTIMA_LEAGUES,
  ULTIMA_LEAGUE_SHORT,
  ULTIMA_SQUAD_FLOOR_PER_LEAGUE,
  ULTIMA_TIMER_OPTIONS,
  formatUltimaTimer,
} from "@/lib/ultima/constants";
import { countByLeague, remainingSlots } from "@/lib/ultima/draft/floor";
import UltimaDraftBoard from "./UltimaDraftBoard";
import UltimaDraftPicker from "./UltimaDraftPicker";
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
  const [state, setState] = useState(null);
  const [available, setAvailable] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState("players");
  const [menuOpen, setMenuOpen] = useState(false);
  const [showFeed, setShowFeed] = useState(false);
  const menuRef = useRef(null);
  const [resetting, setResetting] = useState(false);
  const [keepBusy, setKeepBusy] = useState(false);
  const [autoBusy, setAutoBusy] = useState(false);
  const [timerBusy, setTimerBusy] = useState(false);
  const advancing = useRef(false);
  const [poolLoading, setPoolLoading] = useState(false);

  const fetchState = useCallback(async () => {
    try {
      const url = isPractice
        ? `/api/ultima/practice/state?code=${encodeURIComponent(roomCode)}`
        : "/api/ultima/draft/state";
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) setState(data);
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

  useEffect(() => {
    if (state?.state !== "live") return;
    const botOnClock = Boolean(state.on_clock?.is_bot);
    const timedOut = state.seconds_remaining === 0;
    if (!botOnClock && !timedOut) return;
    if (advancing.current) return;

    let cancelled = false;
    advancing.current = true;
    (async () => {
      try {
        await fetch(isPractice ? "/api/ultima/practice/advance" : "/api/ultima/draft/advance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: isPractice ? JSON.stringify({ code: roomCode }) : "{}",
        });
        if (!cancelled) await fetchState();
      } finally {
        advancing.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    fetchState,
    isPractice,
    roomCode,
    state?.state,
    state?.current_pick,
    state?.on_clock?.is_bot,
    state?.seconds_remaining,
    state?.is_your_turn,
  ]);

  const viewScope = isPractice ? roomCode : managerId;

  useEffect(() => {
    if (!viewScope || typeof window === "undefined") return;
    try {
      const stored = sessionStorage.getItem(viewStorageKey(viewScope));
      if (stored === "players" || stored === "board") setViewMode(stored);
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

  useEffect(() => {
    if (state?.state !== "live" && state?.state !== "paused") return;
    if (available.length) return;
    fetchAvailable();
  }, [available.length, fetchAvailable, state?.state]);

  const draftedIds = useMemo(
    () => new Set((state?.picks ?? []).map((p) => p.player?.id).filter(Boolean)),
    [state?.picks],
  );

  const pool = useMemo(
    () => available.filter((p) => !draftedIds.has(p.id)),
    [available, draftedIds],
  );

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
        setError(data.message ?? "Pick failed.");
      } else {
        await fetchState();
      }
    } catch {
      setError("Connection lost. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function saveQueue(playerIds) {
    await fetch(isPractice ? "/api/ultima/practice/queue" : "/api/ultima/draft/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        isPractice ? { player_ids: playerIds, code: roomCode } : { player_ids: playerIds },
      ),
    });
    fetchState();
  }

  async function queuePlayer(playerId) {
    const current = state?.queue?.map((q) => q.player_id) ?? [];
    if (current.includes(playerId)) return;
    await saveQueue([...current, playerId]);
  }

  async function unqueuePlayer(playerId) {
    const current = state?.queue?.map((q) => q.player_id) ?? [];
    await saveQueue(current.filter((id) => id !== playerId));
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

  if (!state) {
    return (
      <div className={styles.navyRoom}>
        <p className={styles.navyText}>Loading draft room…</p>
      </div>
    );
  }

  async function resetPractice() {
    if (!isPractice || !state.is_host) return;
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
    if (!isPractice || !state.is_host) return;
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

  if (state.state === "lobby") {
    return (
      <div className={styles.navyRoom}>
        <p className={styles.navyText}>
          {isPractice
            ? "Practice lobby. Waiting for the host to start."
            : "Draft lobby. Waiting for the commissioner to start."}
        </p>
        <Link href={isPractice ? "/ultima/practice" : "/ultima"} className={styles.quietLinkLight}>
          {isPractice ? "Back to practice" : "Back to hub"}
        </Link>
      </div>
    );
  }

  if (state.state === "complete") {
    return (
      <div className={styles.navyRoom}>
        <p className={styles.navyTitle}>{isPractice ? "Practice complete" : "Draft complete"}</p>
        <p className={styles.navyText}>
          {isPractice
            ? "Save this board to reopen it from Practice. Picks do not count toward the league."
            : "300 picks made. Set your XV before the first kickoff."}
        </p>
        <UltimaDraftBoard managers={state.managers ?? []} picks={state.picks ?? []} youId={managerId} />
        {isPractice && state.is_host ? (
          <div className={styles.completeActions}>
            <button type="button" className={styles.primaryBtn} onClick={toggleKeep} disabled={keepBusy}>
              {keepBusy ? "Saving…" : state.keep ? "Saved. Tap to forget" : "Save board"}
            </button>
            <button type="button" className={styles.queueBtn} onClick={resetPractice} disabled={resetting}>
              {resetting ? "Resetting…" : "Reset practice"}
            </button>
          </div>
        ) : null}
        <Link href={isPractice ? "/ultima/practice" : "/ultima/squad"} className={styles.quietLinkLight}>
          {isPractice ? "Practice lobby" : "My squad"}
        </Link>
      </div>
    );
  }

  const canForcePick =
    !isPractice &&
    state.is_commissioner &&
    state.state === "live" &&
    state.on_clock &&
    !state.on_clock.is_you;

  const myPicks = (state.picks ?? []).filter((p) => p.manager_id === managerId);
  const leagueCounts = countByLeague(myPicks.map((p) => p.player).filter(Boolean));
  const slotsLeft = remainingSlots(myPicks.length);
  const onClockName = state.on_clock
    ? state.on_clock.is_you
      ? "You are on the clock"
      : `${state.on_clock.team_name}${state.on_clock.is_bot ? " · BOT" : ""}`
    : isPractice
      ? "Practice"
      : "Draft";
  const secondsLabel =
    state.seconds_remaining != null ? String(state.seconds_remaining) : "—";

  function chooseView(next) {
    setViewMode(next);
    setShowFeed(false);
    if (!viewScope) return;
    try {
      sessionStorage.setItem(viewStorageKey(viewScope), next);
    } catch {
      /* private mode */
    }
  }

  const picker = (
    <>
      {error ? <p className={styles.messageError}>{error}</p> : null}
      <UltimaDraftPicker
        available={pool}
        queue={state.queue ?? []}
        loadingPool={poolLoading}
        isYourTurn={state.is_your_turn}
        canForcePick={canForcePick}
        pickBusy={loading}
        compact={false}
        onDraft={draftPlayer}
        onForce={forcePickPlayer}
        onQueue={queuePlayer}
        onUnqueue={unqueuePlayer}
        onClearQueue={() => saveQueue([])}
      />
    </>
  );

  const boardPane =
    (state.picks ?? []).length === 0 ? (
      <p className={styles.draftBoardEmpty}>Board empty. First pick coming.</p>
    ) : (
      <UltimaDraftBoard
        managers={state.managers ?? []}
        picks={state.picks ?? []}
        currentPick={state.current_pick}
        youId={managerId}
        mode="full"
      />
    );

  const feedList = (
    <div className={styles.feedList}>
      {(state.picks ?? []).length === 0 ? (
        <p className={styles.navyText}>No picks yet.</p>
      ) : (
        [...state.picks].reverse().map((p) => (
          <div key={p.pick_number} className={styles.feedRow}>
            <span>R{p.round} · #{p.pick_number}</span>
            <span>
              {p.manager_name}
              {p.is_bot ? " · BOT" : ""}
            </span>
            <span>{p.player?.name}</span>
            {p.forced ? <span className={styles.feedForced}>Forced</span> : null}
            {p.rationale ? <span className={styles.feedBot}>{p.rationale}</span> : null}
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className={`${styles.draftRoom} ultima-live-chrome-off`}>
      <header className={styles.draftSticky}>
        <div className={styles.draftStickyRow}>
          <p className={styles.draftOnClockName}>{onClockName}</p>
          <span className={styles.draftClockSecs} aria-label="Seconds remaining">
            {secondsLabel}
          </span>
          <div className={styles.draftMenuWrap} ref={menuRef}>
            <button
              type="button"
              className={styles.draftMenuBtn}
              aria-label="Draft menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <OverflowIcon />
            </button>
            {menuOpen ? (
              <>
                <div
                  className={styles.draftOverflowBackdrop}
                  aria-hidden
                  onClick={() => setMenuOpen(false)}
                />
                <div className={styles.draftOverflowPanel} role="menu">
                  <Link
                    href="/ultima"
                    className={styles.draftOverflowItem}
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                  >
                    Hub
                  </Link>
                  <button
                    type="button"
                    className={styles.draftOverflowItem}
                    role="menuitem"
                    onClick={() => {
                      setShowFeed((open) => !open);
                      setMenuOpen(false);
                    }}
                  >
                    Feed
                  </button>
                  <button
                    type="button"
                    className={styles.draftOverflowItem}
                    role="menuitem"
                    onClick={() => {
                      toggleAutoDraft();
                      setMenuOpen(false);
                    }}
                    disabled={autoBusy}
                  >
                    {autoBusy ? "…" : state.auto_draft ? "Auto on" : "Auto off"}
                  </button>
                  {isPractice && state.is_host ? (
                    <>
                      <button
                        type="button"
                        className={styles.draftOverflowItem}
                        role="menuitem"
                        onClick={() => {
                          toggleKeep();
                          setMenuOpen(false);
                        }}
                        disabled={keepBusy}
                      >
                        {keepBusy ? "…" : state.keep ? "Saved" : "Save"}
                      </button>
                      <button
                        type="button"
                        className={styles.draftOverflowItem}
                        role="menuitem"
                        onClick={() => {
                          resetPractice();
                          setMenuOpen(false);
                        }}
                        disabled={resetting}
                      >
                        {resetting ? "…" : "Reset"}
                      </button>
                    </>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        </div>
        <div className={styles.draftChipRow} aria-label="League floor">
          {ULTIMA_LEAGUES.map((league) => (
            <span key={league} className={styles.draftChip}>
              {ULTIMA_LEAGUE_SHORT[league]} {leagueCounts[league] ?? 0}/{ULTIMA_SQUAD_FLOOR_PER_LEAGUE}
            </span>
          ))}
          <span className={styles.draftChip}>
            {slotsLeft} pick{slotsLeft === 1 ? "" : "s"} left
          </span>
        </div>
        {state.is_your_turn ? <div className={styles.redProgress} aria-hidden /> : null}
      </header>

      {state.state === "paused" ? (
        <p className={styles.pausedBanner}>Paused by the commissioner</p>
      ) : null}
      {canForcePick ? (
        <p className={styles.floorLine}>Force pick for {state.on_clock.team_name}.</p>
      ) : null}
      {!isPractice && state.is_commissioner ? (
        <div className={styles.timerRow}>
          <span className={styles.timerLabel}>Clock</span>
          {ULTIMA_TIMER_OPTIONS.map((seconds) => (
            <button
              key={seconds}
              type="button"
              className={
                state.timer_seconds === seconds ? styles.timerChipActive : styles.timerChip
              }
              disabled={timerBusy}
              onClick={() => setLiveTimer(seconds)}
            >
              {formatUltimaTimer(seconds)}
            </button>
          ))}
        </div>
      ) : null}

      <div
        className={styles.draftViewToggle}
        role="tablist"
        aria-label="Draft view"
      >
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === "players" && !showFeed}
          className={viewMode === "players" && !showFeed ? styles.draftSegActive : styles.draftSeg}
          onClick={() => chooseView("players")}
        >
          Players
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === "board" && !showFeed}
          className={viewMode === "board" && !showFeed ? styles.draftSegActive : styles.draftSeg}
          onClick={() => chooseView("board")}
        >
          Board
        </button>
      </div>

      {showFeed ? (
        feedList
      ) : (
        <div className={styles.draftBodySplit}>
          <div
            className={styles.draftPanePlayers}
            data-active={viewMode === "players" ? "true" : "false"}
          >
            {picker}
          </div>
          <div
            className={styles.draftPaneBoard}
            data-active={viewMode === "board" ? "true" : "false"}
          >
            {boardPane}
          </div>
        </div>
      )}
    </div>
  );
}
