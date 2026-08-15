"use client";

import { useMemo, useState } from "react";
import {
  ULTIMA_LEAGUES,
  ULTIMA_LEAGUE_COLOURS,
  ULTIMA_LEAGUE_SHORT,
} from "@/lib/ultima/constants";
import styles from "./ultima.module.css";

const PAGE = 25;

const LEAGUE_TABS = [
  { id: "all", label: "All" },
  ...ULTIMA_LEAGUES.map((id) => ({
    id,
    label: ULTIMA_LEAGUE_SHORT[id] ?? id,
  })),
];

function metric(player, key) {
  return Number(player.seed_metrics?.[key] ?? 0);
}

function formatRate(value) {
  return value ? value.toFixed(2) : "—";
}

function formatRating(value) {
  return value ? value.toFixed(1) : "—";
}

export default function UltimaDraftPicker({
  available = [],
  queue = [],
  loadingPool = false,
  isYourTurn = false,
  canForcePick = false,
  pickBusy = false,
  onDraft,
  onForce,
  onQueue,
  onUnqueue,
  onClearQueue,
}) {
  const [query, setQuery] = useState("");
  const [league, setLeague] = useState("all");
  const [sort, setSort] = useState("rating");
  const [shown, setShown] = useState(PAGE);

  const byId = useMemo(() => {
    const map = new Map();
    for (const p of available) map.set(p.id, p);
    return map;
  }, [available]);

  const queued = useMemo(
    () =>
      queue
        .map((q) => byId.get(q.player_id))
        .filter(Boolean),
    [queue, byId],
  );

  const queuedIds = useMemo(
    () => new Set(queue.map((q) => q.player_id)),
    [queue],
  );

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let list = available;

    if (league !== "all") list = list.filter((p) => p.league === league);
    if (needle) {
      list = list.filter(
        (p) =>
          String(p.name ?? "").toLowerCase().includes(needle) ||
          String(p.club ?? "").toLowerCase().includes(needle),
      );
    }

    const sorted = [...list].sort((a, b) => {
      if (sort === "name") {
        return String(a.name ?? "").localeCompare(String(b.name ?? ""));
      }
      const key =
        sort === "goals" ? "goals_rate" : sort === "assists" ? "assists_rate" : "rating_avg";
      const gap = metric(b, key) - metric(a, key);
      if (gap) return gap;
      return String(a.name ?? "").localeCompare(String(b.name ?? ""));
    });

    return sorted;
  }, [available, league, query, sort]);

  const visible = rows.slice(0, shown);

  function toggleSort(next) {
    setSort(next);
    setShown(PAGE);
  }

  return (
    <section className={styles.picker} aria-label="Select a player">
      <div className={styles.pickerHead}>
        <label className={styles.pickerSearchLabel} htmlFor="ultima-draft-search">
          Search
        </label>
        <input
          id="ultima-draft-search"
          className={styles.pickerSearch}
          type="search"
          placeholder="Name or club"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShown(PAGE);
          }}
          autoComplete="off"
        />
      </div>

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
              onClick={() => {
                setLeague(t.id);
                setShown(PAGE);
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {queued.length ? (
        <div className={styles.queueStrip}>
          <p className={styles.queueStripLabel}>Your queue</p>
          <ul className={styles.queueChips}>
            {queued.map((p, i) => (
              <li key={p.id} className={styles.queueChip}>
                <span>
                  {i + 1}. {p.name}
                </span>
                <button
                  type="button"
                  className={styles.queueChipRemove}
                  onClick={() => onUnqueue(p.id)}
                  aria-label={`Remove ${p.name} from queue`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className={styles.queueClear} onClick={onClearQueue}>
            Clear queue
          </button>
        </div>
      ) : (
        <p className={styles.pickerHint}>
          Queue players now. If auto-draft is on, they go in this order.
        </p>
      )}

      {loadingPool && !available.length ? (
        <p className={styles.pickerHint}>Loading players…</p>
      ) : (
        <div className={styles.pickerScroll}>
          <table className={styles.pickerTable}>
            <thead>
              <tr>
                <th scope="col" className={styles.pickerNameCol}>
                  <button type="button" className={styles.pickerSort} onClick={() => toggleSort("name")}>
                    Player{sort === "name" ? " ·" : ""}
                  </button>
                </th>
                <th scope="col">
                  <button
                    type="button"
                    className={styles.pickerSort}
                    onClick={() => toggleSort("rating")}
                  >
                    Rt{sort === "rating" ? " ·" : ""}
                  </button>
                </th>
                <th scope="col">
                  <button
                    type="button"
                    className={styles.pickerSort}
                    onClick={() => toggleSort("goals")}
                  >
                    G/90{sort === "goals" ? " ·" : ""}
                  </button>
                </th>
                <th scope="col">
                  <button
                    type="button"
                    className={styles.pickerSort}
                    onClick={() => toggleSort("assists")}
                  >
                    A/90{sort === "assists" ? " ·" : ""}
                  </button>
                </th>
                <th scope="col">
                  <span className={styles.pickerActionHead}>Pick</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => {
                const fill = ULTIMA_LEAGUE_COLOURS[p.league] ?? "#E4DED3";
                const inQueue = queuedIds.has(p.id);
                return (
                  <tr key={p.id}>
                    <th scope="row" className={styles.pickerNameCell}>
                      <span className={styles.pickerSwatch} style={{ background: fill }} aria-hidden />
                      <span>
                        <span className={styles.pickerPlayer}>{p.name}</span>
                        <span className={styles.pickerMeta}>
                          {p.club} · {ULTIMA_LEAGUE_SHORT[p.league] ?? p.league}
                        </span>
                      </span>
                    </th>
                    <td>{formatRating(metric(p, "rating_avg"))}</td>
                    <td>{formatRate(metric(p, "goals_rate"))}</td>
                    <td>{formatRate(metric(p, "assists_rate"))}</td>
                    <td>
                      <div className={styles.playerActions}>
                        {isYourTurn ? (
                          <button
                            type="button"
                            className={styles.draftBtn}
                            disabled={pickBusy}
                            onClick={() => onDraft(p.id)}
                          >
                            Draft
                          </button>
                        ) : null}
                        {canForcePick ? (
                          <button
                            type="button"
                            className={styles.draftBtn}
                            disabled={pickBusy}
                            onClick={() => onForce(p.id)}
                          >
                            Force
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className={inQueue ? styles.queueBtnOn : styles.queueBtn}
                          onClick={() => (inQueue ? onUnqueue(p.id) : onQueue(p.id))}
                        >
                          {inQueue ? "Queued" : "Queue"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!visible.length ? (
            <p className={styles.pickerHint}>No players match that search.</p>
          ) : null}
          {rows.length > shown ? (
            <button
              type="button"
              className={styles.pickerMore}
              onClick={() => setShown((n) => n + PAGE)}
            >
              Show more · {rows.length - shown} left
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}
