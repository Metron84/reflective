"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ULTIMA_LEAGUE_COLOURS,
  ULTIMA_TIMER_OPTIONS,
  formatUltimaTimer,
} from "@/lib/ultima/constants";
import { lastPicksNewestFirst, playerSurname } from "@/lib/ultima/draft/last-picks";
import {
  deskFloorLine,
  deskForcedLine,
  floorFromState,
  formatPickDeadline,
  othersNeedLine,
} from "@/lib/ultima/draft/desk";
import EmptyState from "@/components/EmptyState";
import UltimaDraftBoard from "./UltimaDraftBoard";
import UltimaDraftFeed from "./UltimaDraftFeed";
import UltimaDraftPath from "./UltimaDraftPath";
import UltimaDraftPicker from "./UltimaDraftPicker";
import UltimaDraftQueue from "./UltimaDraftQueue";
import useUltimaDraftAdvance from "./useUltimaDraftAdvance";
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

function ExitChevron() {
  return (
    <svg className={styles.draftExitChevron} viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill="currentColor"
        d="M14.7 5.3 8 12l6.7 6.7 1.4-1.4L10.8 12l5.3-5.3-1.4-1.4Z"
      />
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
  const [available, setAvailable] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState("desk");
  const [menuOpen, setMenuOpen] = useState(false);
  const [exitConfirm, setExitConfirm] = useState(false);
  const [searchActive, setSearchActive] = useState(false);
  const [boardHistory, setBoardHistory] = useState(false);
  const menuRef = useRef(null);
  const stickyRef = useRef(null);
  const allowLeave = useRef(false);
  const [resetting, setResetting] = useState(false);
  const [keepBusy, setKeepBusy] = useState(false);
  const [autoBusy, setAutoBusy] = useState(false);
  const [timerBusy, setTimerBusy] = useState(false);
  const [poolLoading, setPoolLoading] = useState(false);
  const [focusPick, setFocusPick] = useState(null);
  const [focusGen, setFocusGen] = useState(0);
  const [seenPicks, setSeenPicks] = useState(null);

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

  const { botPicking, humanSeconds, stall, stallDetail, retry } = useUltimaDraftAdvance({
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
      if (stored === "desk" || stored === "queue" || stored === "picks" || stored === "board") {
        setViewMode(stored);
      }
      if (stored === "players") setViewMode("desk");
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
    const el = stickyRef.current;
    const root = el?.parentElement;
    if (!el || !root) return undefined;
    function apply() {
      root.style.setProperty("--ultima-draft-sticky", `${el.offsetHeight}px`);
    }
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, [state?.on_clock, state?.is_your_turn, state?.state, botPicking, stall]);

  useEffect(() => {
    if (state?.state !== "live" && state?.state !== "paused") return;
    if (available.length) return;
    fetchAvailable();
  }, [available.length, fetchAvailable, state?.state]);

  const pickCount = state?.picks?.length ?? 0;

  useEffect(() => {
    if (!state) return;
    if (seenPicks == null) {
      setSeenPicks(pickCount);
      return;
    }
    if (viewMode === "board") setSeenPicks(pickCount);
  }, [state, pickCount, viewMode, seenPicks]);

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
      await fetchState();
      return { ok: true };
    } catch {
      return { ok: false, message: "Connection lost. Try again." };
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

  if (!state) {
    return (
      <div className={`${styles.draftRoom} ultima-live-chrome-off`}>
        <div className={styles.draftSkeleton} aria-busy="true" aria-label="Loading draft room">
          <div className={styles.draftSkeletonBar} />
          <div className={styles.draftSkeletonChip} />
          <div className={styles.draftSkeletonBody} />
        </div>
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
      <div className={`${styles.draftRoom} ultima-live-chrome-off`}>
        <EmptyState
          tone="cream"
          heading={isPractice ? "Practice lobby" : "Draft lobby"}
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
      <div className={`${styles.draftRoom} ultima-live-chrome-off`}>
        <EmptyState
          tone="cream"
          heading={isPractice ? "Practice complete" : "Draft complete"}
          body={
            isPractice
              ? "Save this board to reopen it from Practice. Picks do not count toward the league."
              : "300 picks made. Set your XV before the first kickoff."
          }
          actionLabel={isPractice ? "Practice lobby" : "My squad"}
          actionHref={isPractice ? "/ultima/practice" : "/ultima/squad"}
        />
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
  const floorTokens = deskFloorLine(floor);
  const forcedLine = deskForcedLine(floor);
  const otherNeed = othersNeedLine(state.others_need);
  const deadline = state.is_your_turn
    ? formatPickDeadline(
        state.turn_expires_at,
        state.timer_seconds,
        humanSeconds ?? state.seconds_remaining,
      )
    : null;
  const botOnClock = Boolean(state.on_clock?.is_bot);
  const round = Math.max(1, Math.ceil((state.current_pick || 1) / (state.managers?.length || 10)));
  const yourTurn = Boolean(state.is_your_turn);
  const momentTitle = yourTurn
    ? "YOUR PICK"
    : botOnClock && stall
      ? `${state.on_clock.team_name} · BOT stalled`
      : botOnClock
        ? `${state.on_clock.team_name} is picking`
        : state.on_clock
          ? `${state.on_clock.team_name} is picking`
          : isPractice
            ? "Practice"
            : "Draft";
  const showBotClock = !stall && (botOnClock || botPicking);
  const secondsLabel = showBotClock
    ? null
    : humanSeconds != null
      ? String(humanSeconds)
      : state.seconds_remaining != null
        ? String(state.seconds_remaining)
        : "—";
  const lastPicks = lastPicksNewestFirst(state.picks ?? [], 4);
  const unreadPicks = viewMode !== "picks" && pickCount > (seenPicks ?? 0);
  const queueCount = state.queue?.length ?? 0;

  function chooseView(next) {
    setViewMode(next);
    setBoardHistory(false);
    if (next === "picks" || next === "board") setSeenPicks(pickCount);
    if (!viewScope) return;
    try {
      sessionStorage.setItem(viewStorageKey(viewScope), next);
    } catch {
      /* private mode */
    }
  }

  function openPickOnBoard(pickNumber) {
    setFocusPick(pickNumber);
    setFocusGen((gen) => gen + 1);
    setBoardHistory(true);
    chooseView("board");
  }

  function moveQueue(index, dir) {
    const ids = (state.queue ?? []).map((q) => q.player_id);
    const next = index + dir;
    if (next < 0 || next >= ids.length) return;
    const copy = [...ids];
    const [item] = copy.splice(index, 1);
    copy.splice(next, 0, item);
    saveQueue(copy);
  }

  const picker = (
    <>
      {error ? <p className={styles.messageError}>{error}</p> : null}
      <UltimaDraftPicker
        available={pool}
        queue={state.queue ?? []}
        loadingPool={poolLoading}
        isYourTurn={yourTurn}
        canForcePick={canForcePick}
        pickBusy={loading}
        floor={floor}
        compact
        onSearchActive={setSearchActive}
        onDraft={draftPlayer}
        onForce={forcePickPlayer}
        onQueue={queuePlayer}
        onUnqueue={unqueuePlayer}
        onClearQueue={() => saveQueue([])}
      />
    </>
  );

  const pathPane = (
    <UltimaDraftPath
      managers={state.managers ?? []}
      picks={state.picks ?? []}
      currentPick={state.current_pick}
      youId={managerId}
      onOpenHistory={() => {
        setBoardHistory(true);
        chooseView("board");
      }}
    />
  );

  const queuePane = (
    <UltimaDraftQueue
      queue={state.queue ?? []}
      byId={byId}
      draftedIds={draftedIds}
      floor={floor}
      autoDraft={state.auto_draft}
      autoBusy={autoBusy}
      onToggleAuto={toggleAutoDraft}
      onMove={moveQueue}
      onRemove={unqueuePlayer}
      onDraft={draftPlayer}
      isYourTurn={yourTurn}
      pickBusy={loading}
    />
  );

  const feedPane = <UltimaDraftFeed picks={state.picks ?? []} />;

  const youPickIn = state.you_pick_in;
  const autoLabel = state.auto_draft ? "Auto on" : "Auto off";

  return (
    <div className={`${styles.draftRoom} ${styles.draftDesk} ultima-live-chrome-off`}>
      <header className={styles.draftSticky} ref={stickyRef}>
        <div className={styles.draftStickyRow}>
          <button type="button" className={styles.draftExit} onClick={requestExit}>
            <ExitChevron />
            Exit
          </button>
          <p className={styles.deskRoundPick}>
            R{round} · {state.current_pick ?? "—"}
          </p>
          <span className={styles.deskAutoChip}>{autoLabel}</span>
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
                  <button
                    type="button"
                    className={styles.draftOverflowItem}
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      requestExit();
                    }}
                  >
                    Exit
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

        <div className={yourTurn ? styles.deskMomentYou : styles.deskMoment}>
          {yourTurn ? <div className={styles.deskRedRule} aria-hidden /> : null}
          <p className={styles.deskMomentTitle}>{momentTitle}</p>
          <p className={styles.deskMomentClock}>
            {showBotClock ? (
              <span className={styles.botSpinner} aria-label="Bot picking" />
            ) : deadline ? (
              deadline
            ) : (
              secondsLabel
            )}
          </p>
          <p className={styles.deskMomentSub}>
            {yourTurn
              ? `Pick ${state.current_pick}`
              : youPickIn > 0
                ? `You pick in ${youPickIn}`
                : youPickIn === 0
                  ? "Your pick"
                  : canForcePick
                    ? `Force pick for ${state.on_clock.team_name}`
                    : ""}
          </p>
        </div>

        <p className={styles.deskFloor} aria-label="League floor">
          {floorTokens.map((t) => (
            <span key={t.league}>{t.label}</span>
          ))}
        </p>
        <p className={styles.deskFloorSub}>
          {floor.slotsLeft} pick{floor.slotsLeft === 1 ? "" : "s"} left
          {otherNeed ? ` · ${otherNeed}` : ""}
        </p>
        {forcedLine && yourTurn ? (
          <p className={styles.deskForced}>{forcedLine}</p>
        ) : null}

        {!isPractice && state.is_commissioner ? (
          <div className={styles.deskCommissioner}>
            <button
              type="button"
              className={styles.timerChip}
              disabled={timerBusy}
              onClick={pauseOrResume}
            >
              {state.state === "paused" ? "Resume" : "Pause"}
            </button>
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
      </header>

      {stall ? (
        <button type="button" className={styles.draftStall} onClick={retry}>
          {stallDetail ? (
            <>
              <span className={styles.draftStallLabel}>Draft stalled</span>
              <span className={styles.draftStallDetail}>{stallDetail}</span>
              <span className={styles.draftStallHint}>Tap to retry</span>
            </>
          ) : (
            "Draft stalled, tap to retry"
          )}
        </button>
      ) : null}

      {state.state === "paused" ? (
        <p className={styles.pausedBanner}>Paused by the commissioner</p>
      ) : null}

      <div className={styles.deskBody}>
        <div
          className={styles.deskPaneDesk}
          data-active={viewMode === "desk" ? "true" : "false"}
        >
          {picker}
          {searchActive || !lastPicks.length ? null : (
            <div className={styles.lastPicksStrip} aria-label="Last picks">
              {lastPicks.map((pick, index) => {
                const league = pick.player?.league;
                const label = `${pick.pick_number} · ${playerSurname(pick.player?.name)}`;
                return (
                  <button
                    key={pick.pick_number}
                    type="button"
                    className={
                      index === 0
                        ? `${styles.lastPickChip} ${styles.lastPickChipEnter}`
                        : styles.lastPickChip
                    }
                    style={{ borderLeftColor: ULTIMA_LEAGUE_COLOURS[league] ?? "#0a111f" }}
                    onClick={() => openPickOnBoard(pick.pick_number)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div
          className={styles.deskPanePath}
          data-active={viewMode === "board" && !boardHistory ? "true" : "false"}
        >
          {pathPane}
        </div>
        <div
          className={styles.deskPanePicks}
          data-active={viewMode === "picks" ? "true" : "false"}
        >
          {feedPane}
        </div>
        <div
          className={styles.deskPaneQueue}
          data-active={viewMode === "queue" ? "true" : "false"}
        >
          {queuePane}
        </div>
        <div
          className={styles.deskPaneHistory}
          data-active={viewMode === "board" && boardHistory ? "true" : "false"}
        >
          {boardHistory ? (
            <UltimaDraftBoard
              managers={state.managers ?? []}
              picks={state.picks ?? []}
              currentPick={state.current_pick}
              youId={managerId}
              mode="full"
              reveal
              focusPick={focusPick}
              focusGen={focusGen}
            />
          ) : null}
        </div>
      </div>

      <div className={styles.deskQueueStrip} aria-label="Queue">
        {(state.queue ?? []).slice(0, 3).map((q, i) => {
          const player = byId.get(q.player_id);
          return (
            <span key={q.player_id} className={styles.deskQueueStripItem}>
              {i + 1} {player?.name ?? "Queued"}
            </span>
          );
        })}
        <button type="button" className={styles.deskQueueStripOpen} onClick={() => chooseView("queue")}>
          Open queue
        </button>
      </div>

      <nav className={styles.deskDock} aria-label="Draft desk">
        <button
          type="button"
          className={viewMode === "queue" ? styles.deskDockOn : styles.deskDockBtn}
          onClick={() => chooseView("queue")}
        >
          Queue{queueCount ? ` ${queueCount}` : ""}
        </button>
        <button
          type="button"
          className={viewMode === "picks" ? styles.deskDockOn : styles.deskDockBtn}
          onClick={() => chooseView("picks")}
        >
          Picks
          {unreadPicks ? <span className={styles.draftSegDot} aria-label="New picks" /> : null}
        </button>
        <button
          type="button"
          className={viewMode === "board" ? styles.deskDockOn : styles.deskDockBtn}
          onClick={() => chooseView("board")}
        >
          Board
        </button>
      </nav>

      {viewMode !== "desk" ? (
        <button type="button" className={styles.deskHome} onClick={() => chooseView("desk")}>
          Back to picks
        </button>
      ) : null}

      {exitConfirm ? (
        <div className={styles.confirmSheet} role="dialog" aria-modal="true">
          <div
            className={styles.confirmBackdrop}
            aria-hidden
            onClick={() => setExitConfirm(false)}
          />
          <div className={styles.confirmPanel}>
            <p className={styles.confirmCopy}>
              Leave the draft room? Your clock keeps running.
            </p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.queueBtnDark}
                onClick={() => setExitConfirm(false)}
              >
                Stay
              </button>
              <button type="button" className={styles.deleteConfirmBtn} onClick={leaveRoom}>
                Leave
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
