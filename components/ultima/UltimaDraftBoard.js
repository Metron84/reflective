"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  ULTIMA_DRAFT_ROUNDS,
  ULTIMA_LEAGUES,
  ULTIMA_LEAGUE_COLOURS,
  ULTIMA_LEAGUE_SHORT,
  ULTIMA_LEAGUE_LABELS,
} from "@/lib/ultima/constants";
import styles from "./ultima.module.css";

function pickNumberFor(round, slot, seats) {
  const position = round % 2 === 1 ? slot : seats - slot + 1;
  return (round - 1) * seats + position;
}

function cellContent(pick, number, isCurrent) {
  if (!pick) {
    return (
      <>
        <span className={styles.boardPickNumber}>{number}</span>
        {isCurrent ? <span className={styles.boardOnClock}>On the clock</span> : null}
      </>
    );
  }

  const league = pick.player?.league;
  return (
    <>
      <span className={styles.boardPlayer}>{pick.player?.name ?? "Unknown"}</span>
      <span className={styles.boardMeta}>
        {pick.player?.club}
        {league ? ` · ${ULTIMA_LEAGUE_SHORT[league] ?? league}` : ""}
      </span>
      <span className={styles.boardPickNumber}>{number}</span>
    </>
  );
}

export default function UltimaDraftBoard({
  managers = [],
  picks = [],
  currentPick = 0,
  youId = null,
  mode = "full",
}) {
  const youCell = useRef(null);
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

  useEffect(() => {
    if (columnOnly) return;
    youCell.current?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [columnOnly, youId, currentPick]);

  if (!seats) {
    return <p className={styles.floorLine}>The board appears once seats are filled.</p>;
  }

  const rounds = Array.from({ length: ULTIMA_DRAFT_ROUNDS }, (_, i) => i + 1);

  return (
    <div className={columnOnly ? styles.boardWrapMine : styles.boardWrap}>
      {columnOnly ? null : (
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
      )}

      <div className={styles.boardScroll}>
        <table className={styles.boardGrid}>
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
                    ref={isYou ? youCell : undefined}
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
                  const emptyClass = isCurrent ? styles.boardCellOnClock : styles.boardCellEmpty;
                  const filledClass = isYou ? styles.boardCellYou : styles.boardCell;

                  return (
                    <td
                      key={manager.id}
                      className={`${pick ? filledClass : emptyClass} ${isYou ? styles.boardStickyYou : ""}`}
                      style={pick ? { background: ULTIMA_LEAGUE_COLOURS[league] ?? "#E4DED3" } : undefined}
                    >
                      {cellContent(pick, number, isCurrent)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
