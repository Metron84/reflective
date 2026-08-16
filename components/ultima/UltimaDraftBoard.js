"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  ULTIMA_DRAFT_ROUNDS,
  ULTIMA_LEAGUES,
  ULTIMA_LEAGUE_COLOURS,
  ULTIMA_LEAGUE_LABELS,
} from "@/lib/ultima/constants";
import styles from "./ultima.module.css";

function pickNumberFor(round, slot, seats) {
  const position = round % 2 === 1 ? slot : seats - slot + 1;
  return (round - 1) * seats + position;
}

function surname(name) {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  return parts[parts.length - 1] || "Unknown";
}

const SCROLL_OPTS = { behavior: "smooth", block: "center", inline: "center" };

export default function UltimaDraftBoard({
  managers = [],
  picks = [],
  currentPick = 0,
  youId = null,
  mode = "full",
  reveal = true,
  focusPick = null,
  focusGen = 0,
}) {
  const youHead = useRef(null);
  const currentCell = useRef(null);
  const rootRef = useRef(null);
  const seats = managers.length;
  const columnOnly = mode === "column";

  const ordered = useMemo(() => {
    const seatsInOrder = [...managers].sort((a, b) => (a.draft_slot ?? 0) - (b.draft_slot ?? 0));
    if (columnOnly && youId) {
      return seatsInOrder.filter((m) => m.id === youId);
    }
    return seatsInOrder;
  }, [managers, columnOnly, youId]);

  const byPickNumber = useMemo(() => {
    const map = new Map();
    for (const pick of picks) map.set(pick.pick_number, pick);
    return map;
  }, [picks]);

  function scrollToMine() {
    youHead.current?.scrollIntoView(SCROLL_OPTS);
  }

  function scrollToCurrent() {
    currentCell.current?.scrollIntoView(SCROLL_OPTS);
  }

  useEffect(() => {
    if (columnOnly) return;
    const el = currentCell.current;
    if (!el) return;
    if (el.getClientRects().length === 0) return;
    el.scrollIntoView(SCROLL_OPTS);
  }, [columnOnly, currentPick, reveal, picks.length]);

  useEffect(() => {
    if (columnOnly || !focusPick || !reveal) return undefined;
    const root = rootRef.current;
    if (!root) return undefined;
    let frame2 = 0;
    const frame1 = window.requestAnimationFrame(() => {
      frame2 = window.requestAnimationFrame(() => {
        const el = root.querySelector(`[data-pick-number="${focusPick}"]`);
        if (!el || el.getClientRects().length === 0) return;
        el.scrollIntoView(SCROLL_OPTS);
      });
    });
    return () => {
      window.cancelAnimationFrame(frame1);
      window.cancelAnimationFrame(frame2);
    };
  }, [columnOnly, focusPick, focusGen, reveal]);

  if (!seats) {
    return <p className={styles.floorLine}>The board appears once seats are filled.</p>;
  }

  const empty = picks.length === 0;
  const rounds = Array.from({ length: ULTIMA_DRAFT_ROUNDS }, (_, i) => i + 1);

  return (
    <div className={columnOnly ? styles.boardWrapMine : styles.boardWrap} ref={rootRef}>
      {columnOnly ? null : (
        <>
          <ul className={styles.boardLegend}>
            {ULTIMA_LEAGUES.map((league) => (
              <li key={league} className={styles.boardLegendItem}>
                <span
                  className={styles.boardSwatch}
                  style={{ background: ULTIMA_LEAGUE_COLOURS[league] }}
                  aria-hidden
                />
                {ULTIMA_LEAGUE_LABELS[league]}
              </li>
            ))}
          </ul>
          {empty ? null : (
            <div className={styles.boardJump}>
              <button type="button" className={styles.boardJumpBtn} onClick={scrollToMine}>
                My column
              </button>
              <button type="button" className={styles.boardJumpBtn} onClick={scrollToCurrent}>
                Current pick
              </button>
            </div>
          )}
        </>
      )}

      {empty ? (
        <p className={styles.draftBoardEmpty}>Board empty. First pick coming.</p>
      ) : (
        <div className={styles.boardScroll}>
          <table
            className={styles.boardGrid}
            style={{ "--board-seats": String(ordered.length) }}
          >
            <caption className={styles.boardCaption}>
              {columnOnly
                ? "Your squad, round by round."
                : "Every pick of the draft. Your column stays in view."}
            </caption>
            <thead>
              <tr>
                <th scope="col" className={styles.boardCorner}>
                  Rd
                </th>
                {ordered.map((manager) => {
                  const isYou = manager.id === youId;
                  return (
                    <th
                      key={manager.id}
                      scope="col"
                      ref={isYou ? youHead : undefined}
                      className={isYou ? styles.boardHeadYou : styles.boardHead}
                    >
                      <span className={styles.boardHeadName}>
                        {isYou ? "You" : manager.team_name}
                      </span>
                      {manager.is_bot ? <span className={styles.boardHeadBot}>BOT</span> : null}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rounds.map((round) => (
                <tr key={round}>
                  <th scope="row" className={styles.boardRound}>
                    {round}
                  </th>
                  {ordered.map((manager) => {
                    const slot = manager.draft_slot ?? 1;
                    const number = pickNumberFor(round, slot, seats);
                    const pick = byPickNumber.get(number);
                    const isCurrent = number === currentPick;
                    const isYou = manager.id === youId;
                    const league = pick?.player?.league;
                    const cellClass = pick
                      ? styles.boardCell
                      : isCurrent
                        ? styles.boardCellOnClock
                        : styles.boardCellEmpty;
                    const youClass = isYou ? styles.boardCellYou : "";

                    return (
                      <td
                        key={manager.id}
                        ref={isCurrent ? currentCell : undefined}
                        data-pick-number={number}
                        className={`${cellClass} ${youClass}`.trim()}
                        style={
                          pick
                            ? { borderLeftColor: ULTIMA_LEAGUE_COLOURS[league] ?? "#E4DED3" }
                            : undefined
                        }
                      >
                        {pick ? (
                          <span className={styles.boardPlayer}>
                            {surname(pick.player?.name)}
                          </span>
                        ) : (
                          <span className={styles.boardEmptyInner}>
                            {isCurrent ? <span className={styles.boardClockDot} aria-hidden /> : null}
                            <span className={styles.boardPickNumber}>{number}</span>
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
