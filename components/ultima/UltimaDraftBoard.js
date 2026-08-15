"use client";

import { useMemo } from "react";
import {
  ULTIMA_DRAFT_ROUNDS,
  ULTIMA_LEAGUES,
  ULTIMA_LEAGUE_COLOURS,
  ULTIMA_LEAGUE_SHORT,
  ULTIMA_LEAGUE_LABELS,
} from "@/lib/ultima/constants";
import styles from "./ultima.module.css";

/**
 * Odd rounds run left to right, even rounds run back. Managers keep their column
 * so a squad reads down the page, which is how a snake board is read.
 */
function pickNumberFor(round, slot, seats) {
  const position = round % 2 === 1 ? slot : seats - slot + 1;
  return (round - 1) * seats + position;
}

export default function UltimaDraftBoard({ managers = [], picks = [], currentPick = 0 }) {
  const seats = managers.length;

  const ordered = useMemo(
    () => [...managers].sort((a, b) => (a.draft_slot ?? 0) - (b.draft_slot ?? 0)),
    [managers],
  );

  const byPickNumber = useMemo(() => {
    const map = new Map();
    for (const pick of picks) map.set(pick.pick_number, pick);
    return map;
  }, [picks]);

  if (!seats) {
    return <p className={styles.floorLine}>The board appears once seats are filled.</p>;
  }

  const rounds = Array.from({ length: ULTIMA_DRAFT_ROUNDS }, (_, i) => i + 1);

  return (
    <div className={styles.boardWrap}>
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

      <div className={styles.boardScroll}>
        <table className={styles.boardGrid}>
          <caption className={styles.boardCaption}>
            Every pick of the draft. Rounds down, managers across, each player tinted by league.
          </caption>
          <thead>
            <tr>
              <th scope="col" className={styles.boardCorner}>
                Rd
              </th>
              {ordered.map((manager) => (
                <th key={manager.id} scope="col" className={styles.boardHead}>
                  <span className={styles.boardHeadName}>{manager.team_name}</span>
                  {manager.is_bot ? <span className={styles.boardHeadBot}>BOT</span> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rounds.map((round) => (
              <tr key={round}>
                <th scope="row" className={styles.boardRound}>
                  {round}
                </th>
                {ordered.map((manager, index) => {
                  const number = pickNumberFor(round, index + 1, seats);
                  const pick = byPickNumber.get(number);
                  const isCurrent = number === currentPick;

                  if (!pick) {
                    return (
                      <td
                        key={manager.id}
                        className={isCurrent ? styles.boardCellOnClock : styles.boardCellEmpty}
                      >
                        <span className={styles.boardPickNumber}>{number}</span>
                        {isCurrent ? <span className={styles.boardOnClock}>On the clock</span> : null}
                      </td>
                    );
                  }

                  const league = pick.player?.league;
                  return (
                    <td
                      key={manager.id}
                      className={styles.boardCell}
                      style={{ background: ULTIMA_LEAGUE_COLOURS[league] ?? "#E4DED3" }}
                    >
                      <span className={styles.boardPlayer}>{pick.player?.name ?? "Unknown"}</span>
                      <span className={styles.boardMeta}>
                        {pick.player?.club}
                        {league ? ` · ${ULTIMA_LEAGUE_SHORT[league] ?? league}` : ""}
                      </span>
                      <span className={styles.boardPickNumber}>{number}</span>
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
