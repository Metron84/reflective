"use client";

import { useState } from "react";
import Crest from "./Crest";
import InstallPrompt from "./InstallPrompt";
import { routingStepsForClub } from "@the-crest/lib/next-steps";
import {
  renderShareCardPng,
  shareCrestCard,
} from "@the-crest/lib/share-card";
import { describeMatchClub } from "@the-crest/lib/tier";
import styles from "./ResultScreen.module.css";

/**
 * Crest-first result. Recognition before club. No dead ends.
 * @param {{ scores: number[]; result: object; onRestart: () => void }} props
 */
export default function ResultScreen({ scores, result, onRestart }) {
  const [sharing, setSharing] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);

  const primary = result.primary;
  const club = primary?.club ?? null;
  const steps = club ? routingStepsForClub(club) : [];

  async function onShare() {
    if (!primary || sharing) return;
    setSharing(true);
    try {
      const blob = await renderShareCardPng({
        scores,
        archetypeName: result.archetype.name,
        reading: result.archetype.reading,
        primaryClubName: describeMatchClub(primary.club),
        reason: primary.reason
          ? `A club to know for ${primary.reason}.`
          : "",
      });
      await shareCrestCard(blob, result.archetype.name);
    } finally {
      setSharing(false);
    }
  }

  function handleRestart() {
    if (!confirmRestart) {
      setConfirmRestart(true);
      return;
    }
    onRestart();
  }

  return (
    <section className={styles.screen} aria-label="Your crest result">
      <div className={styles.stack}>
        <Crest scores={scores} animate />

        <h1 className={styles.arch}>{result.archetype.name}</h1>
        <p className={styles.reading}>{result.archetype.reading}</p>

        {result.note ? <p className={styles.note}>{result.note}</p> : null}
        {result.emptyMessage ? (
          <p className={styles.note}>{result.emptyMessage}</p>
        ) : null}

        {primary ? (
          <div className={styles.block}>
            <p className={styles.kicker}>A club to know</p>
            <div className={styles.clubRow}>
              <p className={styles.clubName}>
                {describeMatchClub(primary.club)}
                {primary.club.identity_summary ? (
                  <small>{primary.club.identity_summary}</small>
                ) : null}
              </p>
              {typeof primary.percent === "number" ? (
                <span className={styles.pct}>{primary.percent}%</span>
              ) : null}
            </div>
            {primary.reason ? (
              <p className={styles.reason}>
                Strong on {primary.reason}.
              </p>
            ) : null}
          </div>
        ) : null}

        {result.neighbours?.length ? (
          <div className={styles.block}>
            <p className={styles.kicker}>Near neighbours</p>
            <ul className={styles.list}>
              {result.neighbours.map((n) => (
                <li key={n.club.slug}>
                  <span>{describeMatchClub(n.club)}</span>
                  {typeof n.percent === "number" ? (
                    <span className={styles.pctSmall}>{n.percent}%</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {result.admireFromAfar && result.admireLine ? (
          <div className={styles.block}>
            <p className={styles.kicker}>Admire from afar</p>
            <p className={styles.admire}>{result.admireLine}</p>
          </div>
        ) : null}

        {result.redFlag ? (
          <div className={styles.block}>
            <p className={styles.kicker}>Distance</p>
            <p className={styles.admire}>{result.redFlag.line}</p>
          </div>
        ) : null}

        <div className={styles.block}>
          <p className={styles.kicker}>Next</p>
          <ul className={styles.next}>
            {steps.map((step) => (
              <li key={step.label}>
                {step.href ? (
                  <a href={step.href} target="_blank" rel="noreferrer">
                    {step.label}
                  </a>
                ) : (
                  <span>{step.label}</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {result.showSampleNotice ? (
          <p className={styles.sample}>
            SAMPLE. Club vectors are still under research review.
          </p>
        ) : null}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primary}
            onClick={onShare}
            disabled={sharing || !primary}
          >
            {sharing ? "Preparing…" : "Save my crest"}
          </button>
          <button type="button" className={styles.ghost} onClick={handleRestart}>
            {confirmRestart ? "Clear these answers?" : "Start again"}
          </button>
          {confirmRestart ? (
            <button
              type="button"
              className={styles.ghost}
              onClick={() => setConfirmRestart(false)}
            >
              Back
            </button>
          ) : null}
        </div>
      </div>
      <InstallPrompt show />
    </section>
  );
}
