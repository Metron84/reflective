"use client";

import { useMemo, useState } from "react";
import { ULTIMA_LEAGUES, ULTIMA_LEAGUE_SHORT } from "@/lib/ultima/constants";
import { expectedUltimaPoints } from "@/lib/ultima/projected-points";
import UltimaCountryTag from "./UltimaCountryTag";
import UltimaPlayerSheet from "./UltimaPlayerSheet";
import UltimaStaffMessage from "./UltimaStaffMessage";
import UltimaValueNumber, { percentileInList } from "./UltimaValueNumber";
import useVirtualList from "./useVirtualList";
import styles from "./ultima.module.css";

const ROW_H = 56;
const POSITIONS = ["GK", "DEF", "MID", "FWD"];
const SORTS = [
  { id: "expected", label: "Expected" },
  { id: "goals", label: "Goals" },
  { id: "assists", label: "Assists" },
  { id: "rating", label: "Rating" },
];

function metric(player, key) {
  const n = Number(player?.seed_metrics?.[key]);
  return Number.isFinite(n) ? n : null;
}

function formatRate(value) {
  if (value == null) return "-";
  return value.toFixed(2);
}

function clubKey(name) {
  return String(name ?? "").trim().toLowerCase();
}

function PlusGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path fill="currentColor" d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z" />
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

function StarGlyph({ on = false }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill={on ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.6"
        d="M12 3.8 14.6 9l5.8.8-4.2 4.1 1 5.8L12 16.8 6.8 19.7l1-5.8L3.6 9.8 9.4 9 12 3.8Z"
      />
    </svg>
  );
}

function sortValue(player, sort) {
  if (sort === "goals") return metric(player, "goals_rate") ?? -1;
  if (sort === "assists") return metric(player, "assists_rate") ?? -1;
  if (sort === "rating") return metric(player, "rating_avg") ?? -1;
  return expectedUltimaPoints(player);
}

export default function UltimaDraftPicker({
  available = [],
  queue = [],
  loadingPool = false,
  isYourTurn = false,
  canForcePick = false,
  pickBusy = false,
  floor = null,
  onDraft,
  onForce,
  onQueue,
  onUnqueue,
  openPlayerId = null,
  onOpenPlayer,
  onClosePlayer,
  mode = "draft",
  clubFilter = "",
  onClearClub,
  watchedIds = [],
  hideActions = false,
  embedSheet = false,
  onWatch,
  onSign,
}) {
  const market = mode === "market";
  const [query, setQuery] = useState("");
  const [league, setLeague] = useState("all");
  const [position, setPosition] = useState("all");
  const [needsOnly, setNeedsOnly] = useState(false);
  const [sort, setSort] = useState("expected");

  const queuedIds = useMemo(() => new Set(queue.map((q) => q.player_id)), [queue]);
  const watched = useMemo(() => new Set(watchedIds), [watchedIds]);
  const neededLeagues = useMemo(
    () =>
      ULTIMA_LEAGUES.filter((id) => (floor?.deficits?.[id] ?? 0) > 0),
    [floor],
  );

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let list = available;

    if (league !== "all") list = list.filter((p) => p.league === league);
    if (clubFilter) {
      list = list.filter((p) => clubKey(p.club) === clubKey(clubFilter));
    }
    if (needsOnly && neededLeagues.length) {
      list = list.filter((p) => neededLeagues.includes(p.league));
    }
    if (position !== "all") {
      list = list.filter(
        (p) => String(p.position ?? "").toUpperCase() === position,
      );
    }
    if (needle) {
      list = list.filter(
        (p) =>
          String(p.name ?? "").toLowerCase().includes(needle) ||
          String(p.club ?? "").toLowerCase().includes(needle),
      );
    }

    return [...list].sort((a, b) => {
      if (a.signedBy && !b.signedBy) return 1;
      if (!a.signedBy && b.signedBy) return -1;
      const gap = sortValue(b, market ? sort : "expected") - sortValue(a, market ? sort : "expected");
      if (gap) return gap;
      return String(a.name ?? "").localeCompare(String(b.name ?? ""));
    });
  }, [available, clubFilter, league, market, neededLeagues, needsOnly, position, query, sort]);

  const points = useMemo(
    () => rows.map((p) => expectedUltimaPoints(p)),
    [rows],
  );

  const virtual = useVirtualList({
    count: rows.length,
    rowHeight: ROW_H,
  });

  const openPlayer =
    openPlayerId ? available.find((p) => p.id === openPlayerId) ?? null : null;

  function clearFilters() {
    setQuery("");
    setLeague("all");
    setPosition("all");
    setNeedsOnly(false);
    setSort("expected");
    onClearClub?.();
  }

  const searchId = market ? "ultima-market-search" : "ultima-draft-search";

  const sheetActions = openPlayer
    ? market
      ? [
          ...(!hideActions && !openPlayer.signedBy
            ? [
                {
                  label: "Sign",
                  primary: true,
                  onClick: () => onSign?.(openPlayer),
                },
              ]
            : []),
          {
            label: watched.has(openPlayer.id) ? "Remove star" : "Watch",
            onClick: () => onWatch?.(openPlayer.id, !watched.has(openPlayer.id)),
          },
        ]
      : [
          ...(isYourTurn || canForcePick
            ? [
                {
                  label: canForcePick && !isYourTurn ? "Force" : "Draft",
                  primary: true,
                  disabled: pickBusy,
                  onClick: () =>
                    canForcePick && !isYourTurn
                      ? onForce?.(openPlayer.id)
                      : onDraft?.(openPlayer.id),
                },
              ]
            : []),
          {
            label: queuedIds.has(openPlayer.id) ? "Remove from queue" : "Add to queue",
            onClick: () =>
              queuedIds.has(openPlayer.id)
                ? onUnqueue?.(openPlayer.id)
                : onQueue?.(openPlayer.id),
          },
        ]
    : [];

  const sheet = openPlayer ? (
    <UltimaPlayerSheet
      player={openPlayer}
      points={points}
      onClose={onClosePlayer}
      embedded={embedSheet}
      note={
        openPlayer.signedBy ? `Signed by ${openPlayer.signedBy}` : null
      }
      actions={sheetActions}
    />
  ) : null;

  return (
    <section className={styles.dPick} aria-label="Select a player">
      <div className={styles.dPickSticky}>
        <label className={styles.dPickSr} htmlFor={searchId}>
          Name or club
        </label>
        <input
          id={searchId}
          className={styles.dPickSearch}
          type="search"
          placeholder="Name or club"
          value={query}
          autoComplete="off"
          enterKeyHint="search"
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className={styles.dPickFilters} role="tablist" aria-label="Country">
          <button
            type="button"
            className={league === "all" ? styles.deskTabOn : styles.deskTab}
            onClick={() => setLeague("all")}
          >
            All
          </button>
          {ULTIMA_LEAGUES.map((id) => (
            <button
              key={id}
              type="button"
              className={league === id ? styles.deskTabOn : styles.deskTab}
              onClick={() => setLeague(id)}
            >
              {ULTIMA_LEAGUE_SHORT[id]}
            </button>
          ))}
        </div>
        <div className={styles.dPickFilters} role="tablist" aria-label="Position">
          <button
            type="button"
            className={position === "all" ? styles.deskTabOn : styles.deskTab}
            onClick={() => setPosition("all")}
          >
            All
          </button>
          {POSITIONS.map((id) => (
            <button
              key={id}
              type="button"
              className={position === id ? styles.deskTabOn : styles.deskTab}
              onClick={() => setPosition(id)}
            >
              {id}
            </button>
          ))}
          <button
            type="button"
            className={needsOnly ? styles.deskTabOn : styles.deskTab}
            aria-pressed={needsOnly}
            onClick={() => setNeedsOnly((on) => !on)}
          >
            Needs only
          </button>
        </div>
        {market ? (
          <div className={styles.dPickFilters} role="tablist" aria-label="Sort">
            {SORTS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={sort === item.id ? styles.deskTabOn : styles.deskTab}
                onClick={() => setSort(item.id)}
              >
                {item.label}
              </button>
            ))}
            {clubFilter ? (
              <button
                type="button"
                className={styles.deskTabOn}
                onClick={() => onClearClub?.()}
              >
                {clubFilter}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {loadingPool && !available.length ? (
        <UltimaStaffMessage
          subject="Loading the pool"
          body="The scouts are fetching undrafted players."
        />
      ) : needsOnly && !neededLeagues.length ? (
        <UltimaStaffMessage
          subject="Floors are met"
          body="All country floors are met. Turn off Needs only to see the full list."
        />
      ) : !rows.length ? (
        <div>
          <UltimaStaffMessage
            subject="No players match"
            body={
              position !== "all"
                ? "No positions synced yet. The scouts report when Sportmonks does."
                : market
                  ? "No free agents match that search."
                  : "No players match that search."
            }
          />
          <button type="button" className={styles.dPickClear} onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      ) : (
        <div className={styles.dPickScroll} ref={virtual.ref}>
          <div className={styles.dPickSpacer} style={{ height: virtual.height }}>
            <ul
              className={styles.dPickList}
              style={{ transform: `translateY(${virtual.offset}px)` }}
            >
              {rows.slice(virtual.start, virtual.end).map((player, offset) => {
                const index = virtual.start + offset;
                const pts = expectedUltimaPoints(player);
                const inQueue = queuedIds.has(player.id);
                const goals = metric(player, "goals_rate");
                const assists = metric(player, "assists_rate");
                const watchedOn = watched.has(player.id);
                const canPick = !market && (isYourTurn || canForcePick);
                return (
                  <li key={player.id} style={{ height: ROW_H }}>
                    <div
                      className={[
                        styles.dPickRow,
                        (market && !hideActions) || canPick ? styles.dPickRowMarket : "",
                        hideActions ? styles.dPickRowSolo : "",
                        player.signedBy ? styles.dPickRowTaken : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <button
                        type="button"
                        className={styles.dPickMain}
                        onClick={() => onOpenPlayer?.(player.id)}
                      >
                        <span className={styles.dPickRank}>{index + 1}</span>
                        <span className={styles.dPickCopy}>
                          <span className={styles.dPickName}>{player.name}</span>
                          <span className={styles.dPickMeta}>
                            {player.signedBy
                              ? `Signed by ${player.signedBy}`
                              : player.club || "-"}
                            {player.signedBy ? null : (
                              <>
                                {" · "}
                                {player.position || "-"}{" "}
                                <UltimaCountryTag league={player.league} />
                              </>
                            )}
                          </span>
                        </span>
                        <span className={styles.dPickVals}>
                          <span className={styles.dPickPts}>
                            <UltimaValueNumber
                              value={Number.isFinite(pts) ? pts : null}
                              percentile={percentileInList(pts, points)}
                              digits={1}
                            />
                          </span>
                          <span className={styles.dPickRates}>
                            {`${formatRate(goals)}G · ${formatRate(assists)}A`}
                          </span>
                        </span>
                      </button>
                      {market && !hideActions ? (
                        <>
                          <button
                            type="button"
                            className={watchedOn ? styles.dPickPlusOn : styles.dPickPlus}
                            onClick={() => onWatch?.(player.id, !watchedOn)}
                            aria-label={
                              watchedOn
                                ? `Remove ${player.name} from watchlist`
                                : `Add ${player.name} to watchlist`
                            }
                            aria-pressed={watchedOn}
                          >
                            <StarGlyph on={watchedOn} />
                          </button>
                          {player.signedBy ? (
                            <span className={styles.dPickSignOff}>-</span>
                          ) : (
                            <button
                              type="button"
                              className={styles.dPickSign}
                              onClick={() => onSign?.(player)}
                            >
                              Sign
                            </button>
                          )}
                        </>
                      ) : hideActions ? null : (
                        <>
                          <button
                            type="button"
                            className={inQueue ? styles.dPickPlusOn : styles.dPickPlus}
                            onClick={() =>
                              inQueue ? onUnqueue?.(player.id) : onQueue?.(player.id)
                            }
                            aria-label={
                              inQueue
                                ? `Remove ${player.name} from queue`
                                : `Add ${player.name} to queue`
                            }
                            aria-pressed={inQueue}
                          >
                            {inQueue ? <CheckGlyph /> : <PlusGlyph />}
                          </button>
                          {canPick ? (
                            <button
                              type="button"
                              className={styles.dPickSign}
                              disabled={pickBusy}
                              onClick={() =>
                                canForcePick && !isYourTurn
                                  ? onForce?.(player.id)
                                  : onDraft?.(player.id)
                              }
                            >
                              {canForcePick && !isYourTurn ? "Force" : "Draft"}
                            </button>
                          ) : null}
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {embedSheet ? null : sheet}
    </section>
  );
}
