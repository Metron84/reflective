"use client";

import { useEffect } from "react";
import { SCORING } from "@/lib/kotb";
import styles from "./MatchDetail.module.css";

/**
 * @param {{ match: object|null; onClose: () => void }} props
 */
export default function MatchDetail({ match, onClose }) {
  useEffect(() => {
    if (!match) return undefined;
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [match, onClose]);

  if (!match) return null;
  const photo =
    match.entrantA?.image || match.entrantB?.image || null;

  return (
    <div className={styles.back} role="dialog" aria-modal="true" aria-label="Match detail">
      <button type="button" className={styles.scrim} onClick={onClose} aria-label="Close" />
      <div className={styles.sheet}>
        <div className={styles.hero}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className={styles.heroImg} />
          ) : (
            <div className={styles.heroEmpty} />
          )}
        </div>
        <div className={styles.body}>
          <p className={styles.kicker}>{match.round}{match.order}</p>
          <EntrantDetail entrant={match.entrantA} fallback={match.sourceA} />
          <EntrantDetail entrant={match.entrantB} fallback={match.sourceB} />
        </div>
        <button type="button" className={styles.close} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

function EntrantDetail({ entrant, fallback }) {
  if (!entrant) {
    return <p className={styles.unknown}>{fallback || "To be drawn"}</p>;
  }

  return (
    <section className={styles.block}>
      <h3 className={styles.venue}>{entrant.name}</h3>
      {(entrant.panelScores ?? []).map((panel) => (
        <div key={panel.panelId} className={styles.panel}>
          <p className={styles.panelName}>{panel.panelName}</p>
          <ul className={styles.measures}>
            {SCORING.map((measure) => (
              <li key={measure.key}>
                <span>{measure.label}</span>
                <span className={styles.num}>
                  {panel.measures?.[measure.key] ?? 0}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
