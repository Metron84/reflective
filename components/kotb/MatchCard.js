"use client";

import {
  formatMatchMeta,
  nextTieLabel,
} from "@/lib/kotb";
import styles from "./MatchCard.module.css";

/**
 * @param {{ match: object; onOpen?: (match: object) => void; highlight?: boolean }} props
 */
export default function MatchCard({ match, onOpen, highlight = false }) {
  const next = nextTieLabel(match);

  return (
    <article
      className={`${styles.card} ${highlight ? styles.cardHot : ""}`}
    >
      <button
        type="button"
        className={styles.open}
        onClick={() => onOpen?.(match)}
      >
        <p className={styles.meta}>{formatMatchMeta(match)}</p>
        <EntrantRow
          entrant={match.entrantA}
          source={match.sourceA}
          winnerId={match.winnerId}
        />
        <div className={styles.rule} aria-hidden="true" />
        <EntrantRow
          entrant={match.entrantB}
          source={match.sourceB}
          winnerId={match.winnerId}
        />
        {next ? <p className={styles.footer}>{next}</p> : null}
      </button>
    </article>
  );
}

function EntrantRow({ entrant, source, winnerId }) {
  if (!entrant) {
    return (
      <div className={styles.row}>
        <span className={styles.frame} aria-hidden="true" />
        <div className={styles.names}>
          <p className={styles.source}>{source || "To be drawn"}</p>
        </div>
        <p className={styles.aggregate}>-</p>
      </div>
    );
  }

  const through = winnerId && winnerId === entrant.shortName;
  const out = winnerId && winnerId !== entrant.shortName;

  return (
    <div
      className={`${styles.row} ${through ? styles.through : ""} ${out ? styles.out : ""}`}
    >
      {entrant.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={entrant.image}
          alt={entrant.imageAlt || ""}
          className={styles.photo}
        />
      ) : (
        <span className={styles.photoEmpty} aria-hidden="true" />
      )}
      <div className={styles.names}>
        <p className={styles.venue}>{entrant.name}</p>
        {through ? <p className={styles.tag}>THROUGH</p> : null}
        {out ? <p className={styles.tagOut}>Eliminated</p> : null}
      </div>
      {(entrant.panelScores ?? []).slice(0, 2).map((panel) => (
        <div key={panel.panelId} className={styles.panel}>
          {panel.crest ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={panel.crest}
              alt={panel.panelName}
              className={styles.crest}
            />
          ) : (
            <span className={styles.crest} aria-label={panel.panelName} />
          )}
          <span className={styles.panelScore}>{formatScore(panel.score)}</span>
        </div>
      ))}
      <p className={styles.aggregate}>{formatScore(entrant.aggregate)}</p>
    </div>
  );
}

function formatScore(value) {
  if (value == null) return "-";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
