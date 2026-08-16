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

function SearchGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill="currentColor"
        d="M10 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12Zm0 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm8.3 12.9-3.5-3.5 1.4-1.4 3.5 3.5-1.4 1.4Z"
      />
    </svg>
  );
}

function ClearGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path
        fill="currentColor"
        d="M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6 6.4 5Z"
      />
    </svg>
  );
}

const HINT_KEY = "ultima-draft-hint-dismissed";

export default function UltimaDraftPicker({
  available = [],
  queue = [],
  loadingPool = false,
  isYourTurn = false,
  pickBusy = false,
  onDraft,
  onQueue,
  onUnqueue,
  onClearQueue,
}) {
  const [query, setQuery] = useState("");
  const [league, setLeague] = useState("all");
  const [shown, setShown] = useState(PAGE);
  const [hiddenIds, setHiddenIds] = useState(() => new Set());
  const [toast, setToast] = useState(null);
  const [showHint, setShowHint] = useState(false);

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

  useEffect(() => {
    try {
      setShowHint(window.localStorage.getItem(HINT_KEY) !== "1");
    } catch {
      setShowHint(true);
    }
  }, []);

  const matched = rows.filter((p) => !hiddenIds.has(p.id));
  const visible = matched.slice(0, shown);

  function clearFilters() {
    setQuery("");
    setLeague("all");
    setShown(PAGE);
  }

  function dismissHint() {
    setShowHint(false);
    try {
      window.localStorage.setItem(HINT_KEY, "1");
    } catch {
      /* private mode */
    }
  }

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
    <section className={styles.pickerPick} aria-label="Select a player">
      <div className={styles.pickerSticky}>
        <div className={styles.pickerSearchWrap}>
          <span className={styles.pickerSearchIcon}>
            <SearchGlyph />
          </span>
          <label className={styles.pickerSrOnly} htmlFor="ultima-draft-search">
            Name or club
          </label>
          <input
            id="ultima-draft-search"
            className={styles.pickerSearch}
            type="text"
            placeholder="Name or club"
            value={query}
            autoComplete="off"
            enterKeyHint="search"
            onChange={(e) => {
              setQuery(e.target.value);
              setShown(PAGE);
            }}
          />
          {query ? (
            <button
              type="button"
              className={styles.pickerSearchClear}
              onClick={() => {
                setQuery("");
                setShown(PAGE);
              }}
              aria-label="Clear search"
            >
              <ClearGlyph />
            </button>
          ) : null}
        </div>
        <div className={styles.pickerLeagueRow} role="tablist" aria-label="League filter">
          {LEAGUE_TABS.map((t) => {
            const colour = t.id === "all" ? "#f2ede4" : ULTIMA_LEAGUE_COLOURS[t.id];
            const selected = league === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={selected}
                className={selected ? styles.pickerLeagueChipOn : styles.pickerLeagueChip}
                style={
                  selected
                    ? { background: colour, borderColor: colour, color: "#0a111f" }
                    : { background: "transparent", borderColor: colour, color: "#f2ede4" }
                }
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
      </div>

      <p className={styles.pickerCount} aria-live="polite">
        {matched.length} available
      </p>

      {showHint && !queued.length ? (
        <p className={styles.pickerHintBanner}>
          <span>Queue is your backup if the clock runs out.</span>
          <button type="button" className={styles.pickerHintDismiss} onClick={dismissHint}>
            Got it
          </button>
        </p>
      ) : null}

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
      ) : null}

      {loadingPool && !available.length ? (
        <p className={styles.pickerHint}>Loading players…</p>
      ) : (
        <>
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
            <div className={styles.pickerEmpty}>
              <p className={styles.pickerHint}>No players match that search.</p>
              <button type="button" className={styles.pickerClearFilters} onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          ) : null}
          {matched.length > shown ? (
            <button
              type="button"
              className={styles.pickerMore}
              onClick={() => setShown((n) => n + PAGE)}
            >
              Show more · {matched.length - shown} left
            </button>
          ) : null}
        </>
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
