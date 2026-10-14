"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import {
  parseRevealed,
  revealSnapshot,
  subscribeReveals,
  writeRevealed,
} from "@/lib/crest/reveal-store";
import styles from "./CrestTile.module.css";

/**
 * @param {{
 *   userId: string,
 *   crest: {clubName: string, roomPct: number}|null,
 *   leagues: {savedAt: string, leagues: object[]}|null,
 * }} props
 */
export default function CrestTile({ userId, crest, leagues }) {
  const savedAt = leagues?.savedAt ?? null;
  const rows = leagues?.leagues ?? [];
  const raw = useSyncExternalStore(
    subscribeReveals,
    () => revealSnapshot(userId),
    () => ""
  );
  const revealed = useMemo(() => parseRevealed(raw, savedAt), [raw, savedAt]);

  const allRevealed = rows.length > 0 && rows.every((r) => revealed.includes(r.competition));
  useEffect(() => {
    if (!allRevealed) return;
    // Every League honour. Idempotent, so repeating it on return visits is harmless.
    fetch("/api/account/every-league", { method: "POST" }).catch(() => {});
  }, [allRevealed]);

  const reveal = useCallback(
    (competition) => {
      if (revealed.includes(competition)) return;
      writeRevealed(userId, savedAt, [...revealed, competition]);
    },
    [userId, savedAt, revealed]
  );

  return (
    <article id="crest-tile" className={`${styles.tile} ${crest ? "" : styles.quiet}`}>
      <h3 className={styles.name}>The Crest</h3>

      {crest ? (
        <>
          <dl className={styles.stats}>
            <div>
              <dt>Your club</dt>
              <dd>{crest.clubName}</dd>
            </div>
            <div>
              <dt>Room</dt>
              <dd>{crest.roomPct}%</dd>
            </div>
          </dl>

          {rows.length > 0 ? (
            <ul className={styles.leagues}>
              {rows.map((row) => {
                const open = revealed.includes(row.competition);
                return (
                  <li key={row.competition}>
                    {open ? (
                      <div
                        className={styles.revealed}
                        style={{
                          background: row.primary,
                          color: row.text,
                          borderLeftColor: row.secondary,
                        }}
                      >
                        <span className={styles.leagueName} style={{ color: row.text }}>
                          {row.label}
                        </span>
                        <span className={styles.club}>{row.clubName}</span>
                        <span className={styles.match}>
                          {row.matchPct}% match
                        </span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={styles.hidden}
                        onClick={() => reveal(row.competition)}
                      >
                        <span className={styles.leagueName}>{row.label}</span>
                        <span className={styles.tap}>Tap to reveal your club in this league</span>
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </>
      ) : (
        <p className={styles.empty}>Swipe The Crest to unlock your leagues</p>
      )}

      <Link href="/crest" className={styles.cta}>
        {crest ? "Swipe again" : "Play your first"}
      </Link>
    </article>
  );
}
