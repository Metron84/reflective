"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ULTIMA_LEAGUES,
  ULTIMA_LEAGUE_COLOURS,
  ULTIMA_LEAGUE_SHORT,
  ULTIMA_TIMER_OPTIONS,
  ULTIMA_TOTAL_PICKS,
  formatUltimaTimer,
} from "@/lib/ultima/constants";
import UltimaDraftBoard from "./UltimaDraftBoard";
import styles from "./ultima.module.css";

const LEAGUE_TABS = [
  { id: "all", label: "All" },
  ...ULTIMA_LEAGUES.map((id) => ({
    id,
    label: ULTIMA_LEAGUE_SHORT[id] ?? id,
  })),
];

export default function UltimaDraftRoom({
  managerId,
  variant = "season",
  roomCode = null,
}) {
  const isPractice = variant === "practice";
  const [state, setState] = useState(null);
  const [league, setLeague] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("board");
  const [resetting, setResetting] = useState(false);
  const [autoBusy, setAutoBusy] = useState(false);
  const [timerBusy, setTimerBusy] = useState(false);

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
    const botOnClock = Boolean(state?.on_clock?.is_bot);
    const ms = botOnClock ? 800 : isPractice ? 2000 : 5000;
    const poll = setInterval(fetchState, ms);
    return () => clearInterval(poll);
  }, [fetchState, isPractice, state?.on_clock?.is_bot]);

  // Best available first, so the new prior-season ratings actually help a pick.
  const sortedAvailable = useMemo(() => {
    const rows = state?.available ?? [];
    return [...rows].sort((a, b) => {
      const ratingGap = (b.seed_metrics?.rating_avg ?? 0) - (a.seed_metrics?.rating_avg ?? 0);
      if (ratingGap) return ratingGap;

      const goalGap = (b.seed_metrics?.goals_rate ?? 0) - (a.seed_metrics?.goals_rate ?? 0);
      if (goalGap) return goalGap;

      return String(a.name ?? "").localeCompare(String(b.name ?? ""));
    });
  }, [state?.available]);

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

  async function queuePlayer(playerId) {
    const current = state?.queue?.map((q) => q.player_id) ?? [];
    if (current.includes(playerId)) return;
    await fetch(isPractice ? "/api/ultima/practice/queue" : "/api/ultima/draft/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        isPractice
          ? { player_ids: [...current, playerId], code: roomCode }
          : { player_ids: [...current, playerId] },
      ),
    });
    fetchState();
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
            ? "Practice picks do not count. Reset and run it again, or return to the hub."
            : "300 picks made. Set your XV before the first kickoff."}
        </p>
        <UltimaDraftBoard managers={state.managers ?? []} picks={state.picks ?? []} />
        {isPractice && state.is_host ? (
          <button type="button" className={styles.primaryBtn} onClick={resetPractice} disabled={resetting}>
            {resetting ? "Resetting…" : "Reset practice"}
          </button>
        ) : null}
        <Link href={isPractice ? "/ultima/practice" : "/ultima/squad"} className={styles.quietLinkLight}>
          {isPractice ? "Practice lobby" : "My squad"}
        </Link>
      </div>
    );
  }

  const filtered =
    league === "all"
      ? sortedAvailable
      : sortedAvailable.filter((p) => p.league === league);

  const canForcePick =
    !isPractice &&
    state.is_commissioner &&
    state.state === "live" &&
    state.on_clock &&
    !state.on_clock.is_you;

  return (
    <div className={styles.draftRoom}>
      <header className={styles.draftHeader}>
        <Link href="/ultima" className={styles.quietLinkLight}>
          Hub
        </Link>
        <p className={styles.draftEyebrow}>{isPractice ? "PRACTICE · LIVE" : "DRAFT · LIVE"}</p>
        <h1 className={styles.draftTitle}>Pick {state.current_pick} of {ULTIMA_TOTAL_PICKS}</h1>
        {state.on_clock ? (
          <p className={styles.onClock}>
            {state.on_clock.is_you ? (
              <>
                You are on the clock
                {state.seconds_remaining != null ? (
                  <span className={styles.clockBar}>
                    {" "}
                    · {state.seconds_remaining}s
                  </span>
                ) : null}
              </>
            ) : (
              <>
                {state.on_clock.team_name}
                {state.on_clock.is_bot ? " · BOT" : ""} on the clock
                {state.seconds_remaining != null ? (
                  <span className={styles.clockBar}> · {state.seconds_remaining}s</span>
                ) : null}
              </>
            )}
          </p>
        ) : null}
        {state.is_your_turn ? <div className={styles.redProgress} aria-hidden /> : null}
        <p className={styles.floorLine}>{state.floor_counter}</p>
        {state.auto_draft ? (
          <p className={styles.floorLine}>
            Auto-draft is on. The board picks from your queue, then ranking.
          </p>
        ) : null}
        {canForcePick ? (
          <p className={styles.floorLine}>
            Force pick for {state.on_clock.team_name}. Use when they are away.
          </p>
        ) : null}
        {state.state === "paused" ? (
          <p className={styles.pausedBanner}>Paused by the commissioner</p>
        ) : null}
        <div className={styles.draftControls}>
          <button
            type="button"
            className={state.auto_draft ? styles.autoDraftOn : styles.queueBtn}
            onClick={toggleAutoDraft}
            disabled={autoBusy}
          >
            {autoBusy ? "Saving…" : state.auto_draft ? "Auto-draft on" : "Auto-draft off"}
          </button>
          {isPractice && state.is_host ? (
            <button type="button" className={styles.queueBtn} onClick={resetPractice} disabled={resetting}>
              {resetting ? "Resetting…" : "Reset"}
            </button>
          ) : null}
        </div>
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
      </header>

      <div className={styles.draftTabs}>
        <button
          type="button"
          className={tab === "players" ? styles.tabActive : styles.tab}
          onClick={() => setTab("players")}
        >
          Players
        </button>
        <button
          type="button"
          className={tab === "board" ? styles.tabActive : styles.tab}
          onClick={() => setTab("board")}
        >
          Board
        </button>
        <button
          type="button"
          className={tab === "feed" ? styles.tabActive : styles.tab}
          onClick={() => setTab("feed")}
        >
          Feed
        </button>
      </div>

      {tab === "board" ? (
        <UltimaDraftBoard
          managers={state.managers ?? []}
          picks={state.picks ?? []}
          currentPick={state.current_pick}
        />
      ) : tab === "feed" ? (
        <div className={styles.feedList}>
          {[...state.picks].reverse().map((p) => (
            <div key={p.pick_number} className={styles.feedRow}>
              <span>R{p.round} · #{p.pick_number}</span>
              <span>{p.manager_name}{p.is_bot ? " · BOT" : ""}</span>
              <span>{p.player?.name}</span>
              {p.forced ? <span className={styles.feedForced}>Forced</span> : null}
              {p.rationale ? <span className={styles.feedBot}>{p.rationale}</span> : null}
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className={styles.leagueTabs}>
            {LEAGUE_TABS.map((t) => {
              const fill = t.id === "all" ? null : ULTIMA_LEAGUE_COLOURS[t.id];
              return (
                <button
                  key={t.id}
                  type="button"
                  className={
                    fill
                      ? league === t.id
                        ? styles.leagueChipActive
                        : styles.leagueChip
                      : league === t.id
                        ? styles.leagueTabActive
                        : styles.leagueTab
                  }
                  style={fill ? { background: fill } : undefined}
                  onClick={() => setLeague(t.id)}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {error ? <p className={styles.messageError}>{error}</p> : null}

          <ul className={styles.playerList}>
            {filtered.map((p) => (
              <li key={p.id} className={styles.playerRow}>
                <div>
                  <strong>{p.name}</strong>
                  <span className={styles.playerMeta}>
                    {p.club} · {ULTIMA_LEAGUE_SHORT[p.league] ?? p.league}
                  </span>
                </div>
                <div className={styles.playerActions}>
                  {state.is_your_turn ? (
                    <button
                      type="button"
                      className={styles.draftBtn}
                      disabled={loading}
                      onClick={() => draftPlayer(p.id)}
                    >
                      Draft
                    </button>
                  ) : null}
                  {canForcePick ? (
                    <button
                      type="button"
                      className={styles.draftBtn}
                      disabled={loading}
                      onClick={() => forcePickPlayer(p.id)}
                    >
                      Force pick
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={styles.queueBtn}
                    onClick={() => queuePlayer(p.id)}
                  >
                    Queue
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
