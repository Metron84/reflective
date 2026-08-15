"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ULTIMA_LEAGUES, ULTIMA_LEAGUE_SHORT, ULTIMA_TOTAL_PICKS } from "@/lib/ultima/constants";
import styles from "./ultima.module.css";

const LEAGUE_TABS = [
  { id: "all", label: "All" },
  ...ULTIMA_LEAGUES.map((id) => ({
    id,
    label: ULTIMA_LEAGUE_SHORT[id] ?? id,
  })),
];

export default function UltimaDraftRoom({ managerId }) {
  const [state, setState] = useState(null);
  const [league, setLeague] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("board");

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch("/api/ultima/draft/state");
      const data = await res.json();
      if (res.ok) setState(data);
    } catch {
      /* reconnect silently */
    }
  }, []);

  useEffect(() => {
    fetchState();
    const es = new EventSource("/api/ultima/stream");
    es.addEventListener("draft.pick", fetchState);
    es.addEventListener("draft.state", fetchState);
    es.addEventListener("draft.tick", fetchState);
    const poll = setInterval(fetchState, 5000);
    return () => {
      es.close();
      clearInterval(poll);
    };
  }, [fetchState]);

  async function draftPlayer(playerId) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ultima/draft/pick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player_id: playerId }),
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
    await fetch("/api/ultima/draft/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player_ids: [...current, playerId] }),
    });
    fetchState();
  }

  if (!state) {
    return (
      <div className={styles.navyRoom}>
        <p className={styles.navyText}>Loading draft room…</p>
      </div>
    );
  }

  if (state.state === "lobby") {
    return (
      <div className={styles.navyRoom}>
        <p className={styles.navyText}>Draft lobby. Waiting for the commissioner to start.</p>
        <Link href="/ultima" className={styles.quietLinkLight}>
          Back to hub
        </Link>
      </div>
    );
  }

  if (state.state === "complete") {
    return (
      <div className={styles.navyRoom}>
        <p className={styles.navyTitle}>Draft complete</p>
        <p className={styles.navyText}>300 picks made. Set your XV before the first kickoff.</p>
        <div className={styles.feedList}>
          {state.picks.slice(0, 20).map((p) => (
            <div key={p.pick_number} className={styles.feedRow}>
              <span>R{p.round} · #{p.pick_number}</span>
              <span>{p.manager_name}</span>
              <span>{p.player?.name}</span>
              {p.rationale ? <span className={styles.feedBot}>{p.rationale}</span> : null}
            </div>
          ))}
        </div>
        <Link href="/ultima/squad" className={styles.primaryBtn}>
          My squad
        </Link>
      </div>
    );
  }

  const filtered =
    league === "all"
      ? state.available
      : state.available.filter((p) => p.league === league);

  const forcedFilter =
    state.floor_mode === "forced"
      ? filtered.filter((p) => {
          const need = state.floor_counter?.includes("need");
          return need ? true : true;
        })
      : filtered;

  return (
    <div className={styles.draftRoom}>
      <header className={styles.draftHeader}>
        <Link href="/ultima" className={styles.quietLinkLight}>
          Hub
        </Link>
        <p className={styles.draftEyebrow}>DRAFT · LIVE</p>
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
              </>
            )}
          </p>
        ) : null}
        {state.is_your_turn ? <div className={styles.redProgress} aria-hidden /> : null}
        <p className={styles.floorLine}>{state.floor_counter}</p>
        {state.state === "paused" ? (
          <p className={styles.pausedBanner}>Paused by the commissioner</p>
        ) : null}
      </header>

      <div className={styles.draftTabs}>
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

      {tab === "feed" ? (
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
            {LEAGUE_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={league === t.id ? styles.leagueTabActive : styles.leagueTab}
                onClick={() => setLeague(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {error ? <p className={styles.messageError}>{error}</p> : null}

          <ul className={styles.playerList}>
            {forcedFilter.map((p) => (
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
