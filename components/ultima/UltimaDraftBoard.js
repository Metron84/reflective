"use client";

import { useEffect, useMemo, useRef } from "react";
import { ULTIMA_DRAFT_ROUNDS } from "@/lib/ultima/constants";
import UltimaCountryTag from "./UltimaCountryTag";
import UltimaStaffMessage from "./UltimaStaffMessage";
import styles from "./ultima.module.css";

function pickNumberFor(round, slot, seats) {
  const position = round % 2 === 1 ? slot : seats - slot + 1;
  return (round - 1) * seats + position;
}

function surname(name) {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  return parts[parts.length - 1] || "-";
}

const SCROLL_OPTS = { behavior: "smooth", block: "center", inline: "center" };

export default function UltimaDraftBoard({
  managers = [],
  picks = [],
  currentPick = 0,
  youId = null,
  focusPick = null,
  focusGen = 0,
}) {
  const youHead = useRef(null);
  const currentCell = useRef(null);
  const rootRef = useRef(null);
  const seats = managers.length;

  const ordered = useMemo(() => {
    return [...managers].sort((a, b) => (a.draft_slot ?? 0) - (b.draft_slot ?? 0));
  }, [managers]);

  const byPickNumber = useMemo(() => {
    const map = new Map();
    for (const pick of picks) map.set(pick.pick_number, pick);
    return map;
  }, [picks]);

  useEffect(() => {
    const el = currentCell.current;
    if (!el || el.getClientRects().length === 0) return;
    el.scrollIntoView(SCROLL_OPTS);
  }, [currentPick, picks.length]);

  useEffect(() => {
    if (!focusPick) return undefined;
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
  }, [focusPick, focusGen]);

  if (!seats) {
    return (
      <UltimaStaffMessage
        subject="The board is empty"
        body="The board appears once seats are filled."
      />
    );
  }

  const rounds = Array.from({ length: ULTIMA_DRAFT_ROUNDS }, (_, i) => i + 1);

  return (
    <div className={styles.dBoard} ref={rootRef}>
      <div className={styles.dBoardScroll}>
        <table
          className={styles.dBoardGrid}
          style={{ "--board-seats": String(ordered.length) }}
        >
          <caption className={styles.dBoardCaption}>
            Snake draft. Your column carries the team stripe.
          </caption>
          <thead>
            <tr>
              <th scope="col" className={styles.dBoardCorner}>
                Rd
              </th>
              {ordered.map((manager) => {
                const isYou = manager.id === youId;
                return (
                  <th
                    key={manager.id}
                    scope="col"
                    ref={isYou ? youHead : undefined}
                    className={isYou ? styles.dBoardHeadYou : styles.dBoardHead}
                  >
                    {isYou ? "You" : manager.team_name}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rounds.map((round) => (
              <tr key={round}>
                <th scope="row" className={styles.dBoardRound}>
                  {round}
                </th>
                {ordered.map((manager) => {
                  const slot = manager.draft_slot ?? 1;
                  const number = pickNumberFor(round, slot, seats);
                  const pick = byPickNumber.get(number);
                  const isCurrent = number === currentPick;
                  const isYou = manager.id === youId;
                  return (
                    <td
                      key={manager.id}
                      ref={isCurrent ? currentCell : undefined}
                      data-pick-number={number}
                      className={[
                        styles.dBoardCell,
                        isYou ? styles.dBoardCellYou : "",
                        isCurrent ? styles.dBoardCellNow : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {pick ? (
                        <span className={styles.dBoardPlayer}>
                          {surname(pick.player?.name)}
                          <UltimaCountryTag league={pick.player?.league} />
                        </span>
                      ) : (
                        <span className={styles.dBoardEmpty}>{number}</span>
                      )}
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
