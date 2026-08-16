"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ULTIMA_LEAGUES,
  ULTIMA_LEAGUE_COLOURS,
  ULTIMA_LEAGUE_SHORT,
} from "@/lib/ultima/constants";
import styles from "./ultima.module.css";

const PAGE = 25;
const TOAST_MS = 2400;

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
  return value ? value.toFixed(2) : "0.00";
}

function formatRating(value) {
  return value ? value.toFixed(1) : "0.0";
}

function PlusGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill="currentColor"
        d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z"
      />
    </svg>
  );
}

function CheckGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill="currentColor"
        d="M9.2 16.2 4.8 11.8l1.4-1.4 3 3 8.6-8.6 1.4 1.4-10 10Z"
      />
    </svg>
  );
}

export default function UltimaDraftPicker({
  available = [],
  queue = [],
  loadingPool = false,
  isYourTurn = false,
  pickBusy = false,
  compact = false,
  onDraft,
  onQueue,
  onUnqueue,
  onClearQueue,
}) {
  const [query, setQuery] = useState("");
  const [league, setLeague] = useState("all");
  const [shown, setShown] = useState(compact ? 8 : PAGE);
  const [hiddenIds, setHiddenIds] = useState(() => new Set());
  const [toast, setToast] = useState(null);

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
      const gap = metric(b, "rating_avg") - metric(a, "rating_avg");
      if (gap) return gap;
      return String(a.name ?? "").localeCompare(String(b.name ?? ""));
    });

    return sorted;
  }, [available, league, query]);

  useEffect(() => {
    setHiddenIds((current) => {
      if (!current.size) return current;
      const still = new Set();
      const present = new Set(available.map((p) => p.id));
      for (const id of current) {
        if (present.has(id)) still.add(id);
      }
      return still.size === current.size ? current : still;
    });
  }, [available]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const visible = rows.filter((p) => !hiddenIds.has(p.id)).slice(0, shown);

  async function pickPlayer(player) {
    if (!isYourTurn || pickBusy) return;
    setHiddenIds((current) => {
      const next = new Set(current);
      next.add(player.id);
      return next;
    });
    setToast({ ok: true, text: `Drafted ${player.name}` });
    const result = await onDraft?.(player.id);
    if (result?.ok !== false) return;
    setHiddenIds((current) => {
      const next = new Set(current);
      next.delete(player.id);
      return next;
    });
    setToast({ ok: false, text: result.message ?? "Pick failed." });
  }

  return (
    <section
      className={compact ? styles.pickerCompact : styles.pickerPick}
      aria-label="Select a player"
    >
      <div className={styles.pickerHead}>
        <label className={styles.pickerSearchLabel} htmlFor="ultima-draft-search">
          Search
        </label>
        <input
          id="ultima-draft-search"
          className={styles.pickerSearch}
          type="search"
          placeholder={compact ? "Queue a name or club" : "Name or club"}
          value={query}
          autoFocus={!compact}
          autoComplete="off"
          onChange={(e) => {
            setQuery(e.target.value);
            setShown(compact ? 8 : PAGE);
          }}
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
      ) : compact ? (
        <p className={styles.pickerHint}>Queue while you wait. Search a name, then Queue.</p>
      ) : (
        <p className={styles.pickerHint}>Search, then Draft. Queue is your backup if the clock runs out.</p>
      )}

      {loadingPool && !available.length ? (
        <p className={styles.pickerHint}>Loading players…</p>
      ) : (
        <div className={styles.pickerScroll}>
          <ul className={styles.pickerRowList}>
            {visible.map((p) => {
              const fill = ULTIMA_LEAGUE_COLOURS[p.league] ?? "#E4DED3";
              const inQueue = queuedIds.has(p.id);
              const stats = `${formatRating(metric(p, "rating_avg"))} · ${formatRate(metric(p, "goals_rate"))} G · ${formatRate(metric(p, "assists_rate"))} A`;
              return (
                <li
                  key={p.id}
                  className={styles.pickerRow}
                  style={{ borderLeftColor: fill }}
                >
                  <div className={styles.pickerRowInfo}>
                    <p className={styles.pickerRowName}>{p.name}</p>
                    <p className={styles.pickerRowLine2}>
                      <span>
                        {p.club} · {ULTIMA_LEAGUE_SHORT[p.league] ?? p.league}
                      </span>
                      <span className={styles.pickerRowStats}>{stats}</span>
                    </p>
                  </div>
                  <div className={styles.pickerRowActions}>
                    <button
                      type="button"
                      className={isYourTurn ? styles.pickerPickBtn : styles.pickerPickBtnOff}
                      disabled={!isYourTurn || pickBusy}
                      onClick={() => pickPlayer(p)}
                    >
                      Pick
                    </button>
                    <button
                      type="button"
                      className={inQueue ? styles.pickerQueueBtnOn : styles.pickerQueueBtn}
                      onClick={() => (inQueue ? onUnqueue(p.id) : onQueue(p.id))}
                      aria-label={
                        inQueue ? `Remove ${p.name} from queue` : `Add ${p.name} to queue`
                      }
                      aria-pressed={inQueue}
                    >
                      {inQueue ? <CheckGlyph /> : <PlusGlyph />}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          {!visible.length ? (
            <p className={styles.pickerHint}>No players match that search.</p>
          ) : null}
          {rows.filter((p) => !hiddenIds.has(p.id)).length > shown ? (
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
      {toast ? (
        <p
          className={toast.ok ? styles.pickerToast : styles.pickerToastError}
          role="status"
        >
          {toast.text}
        </p>
      ) : null}
    </section>
  );
}
