"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ProgrammeCTA from "@/components/ProgrammeCTA";
import { DEFAULT_ALPHA, arrivalSummary } from "@/lib/crest/match";
import { buildOutcome } from "@/lib/crest/outcome";
import { CONFIDENT_ROOM_PCT } from "@/lib/crest/report";
import { logFinishedRun } from "@/lib/crest/runLog";
import { cardDataFrom, renderShareCard, shareCard, shareKicker } from "@/lib/crest/shareCard";
import styles from "./CrestSwipe.module.css";

const APP_VERSION = "0.1.0";

/**
 * Result screen on The Reflective. Born to and Built for, then the account save.
 *
 * @param {{
 *   answers: import("@/lib/crest/engine").CrestAnswer[],
 *   group: string|null,
 *   stake?: string|null,
 *   roots?: import("@/lib/crest/roots").CrestRoots|null,
 *   runId?: number,
 *   saveState?: "idle"|"saving"|"saved"|"error",
 *   saveMessage?: string,
 *   signedIn?: boolean|null,
 *   onSave?: () => void,
 *   onKeepResult?: () => void,
 *   onRestart: () => void,
 * }} props
 */
export default function CrestArrival({
  answers,
  group,
  stake = null,
  roots = null,
  runId = 0,
  saveState = "idle",
  saveMessage = "",
  signedIn = null,
  onSave,
  onKeepResult,
  onRestart,
}) {
  const [ready, setReady] = useState(false);
  const [shareState, setShareState] = useState("idle");
  const [worldOpen, setWorldOpen] = useState(false);

  const outcome = useMemo(
    () => buildOutcome(answers, { group, stake, roots }),
    [answers, group, stake, roots],
  );
  const summary = useMemo(
    () => arrivalSummary(answers, DEFAULT_ALPHA, { group, stake }),
    [answers, group, stake],
  );

  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), 500);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!runId || !outcome.built) return;
    logFinishedRun(runId, {
      appVersion: APP_VERSION,
      scope: group,
      stake,
      roots,
      answers,
      built: outcome.built,
      runnerUp: outcome.runnerUp,
      born: outcome.born,
      regions: outcome.regions,
    });
  }, [runId, outcome, group, stake, roots, answers]);

  const built = outcome.built;
  const hero = heroOf(outcome);
  const heroSlug = hero?.slug || null;

  async function shareResult() {
    if (!ready || shareState === "busy" || !built) return;
    setShareState("busy");
    try {
      const kicker = shareKicker(built.percentage, !outcome.closeCall);
      const blob = await renderShareCard(cardDataFrom(summary, built.percentage, kicker));
      const shareName = hero?.name || built.name;
      const result = await shareCard(blob, shareName);
      setShareState(result === "saved" ? "saved" : "idle");
    } catch {
      setShareState("idle");
    }
  }

  if (!built) return null;

  return (
    <section className={styles.arrival}>
      <ResultCards outcome={outcome} />

      {outcome.closeCall && outcome.runnerUp ? (
        <p className={styles.line}>
          Close call: {outcome.runnerUp.name} is right behind at {outcome.runnerUp.percentage}%.
        </p>
      ) : null}

      {outcome.deciding.length && outcome.runnerUp ? (
        <div className={styles.flags}>
          <h2 className={styles.subhead}>What decided it over {outcome.runnerUp.name}</h2>
          {outcome.deciding.map((row) => (
            <div key={row.id} className={styles.flag}>
              <strong>{row.question}</strong>
              <span>{row.answer}</span>
            </div>
          ))}
        </div>
      ) : null}

      <h2 className={styles.subhead}>Your club in every league</h2>
      <ul className={styles.leagueList}>
        {outcome.regions.map((row) => {
          const hit = row.top?.slug && row.top.slug === heroSlug;
          const world = row.region === "Rest of the World";
          return (
            <li key={row.region}>
              <button
                type="button"
                className={`${styles.leagueRow} ${hit ? styles.leagueRowOn : ""}`}
                onClick={() => {
                  if (world) setWorldOpen((open) => !open);
                }}
                aria-expanded={world ? worldOpen : undefined}
              >
                <span>{row.region}</span>
                <strong>{row.top ? row.top.name : "None in this search"}</strong>
                <span>{row.top ? `${row.top.percentage}%` : ""}</span>
              </button>
              {world && worldOpen ? (
                <ul className={styles.leagueSub}>
                  {(row.sub || []).map((sub) => {
                    const subHit = sub.top?.slug && sub.top.slug === heroSlug;
                    return (
                      <li key={sub.subregion} className={subHit ? styles.leagueRowOn : undefined}>
                        <span>{sub.subregion}</span>
                        <strong>{sub.top ? sub.top.name : "None in this search"}</strong>
                        <span>{sub.top ? `${sub.top.percentage}%` : ""}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className={styles.next}>
        {signedIn && saveState !== "saved" && onSave ? (
          <button type="button" className={styles.saveCta} onClick={onSave} disabled={!ready || saveState === "saving"}>
            {saveState === "saving" ? "Saving…" : "Save your results"}
          </button>
        ) : null}
        {signedIn === false || saveState === "saved" ? (
          <ProgrammeCTA signedIn={saveState === "saved"} onStart={onKeepResult} />
        ) : null}
        {saveMessage ? <p className={styles.saveNote}>{saveMessage}</p> : null}
        <button type="button" className={styles.again} onClick={shareResult} disabled={!ready || shareState === "busy"}>
          {shareState === "saved" ? "Card saved, link copied" : "Share your FC"}
        </button>
        <button type="button" className={styles.again} onClick={onRestart}>
          Swipe again
        </button>
        <div className={styles.nextPair}>
          <Link href="/films" className={styles.nextGhost}>
            Watch the films
          </Link>
        </div>
      </div>
    </section>
  );
}

/**
 * @param {{ outcome: ReturnType<typeof buildOutcome> }} props
 */
function ResultCards({ outcome }) {
  const { built, born } = outcome;
  if (!built) return null;

  if (!born) {
    const label = built.percentage >= CONFIDENT_ROOM_PCT ? "Your FC" : "Closest match";
    return <ClubCard label={label} name={built.name} color={built.color} percentage={built.percentage} />;
  }

  if (born.typed) {
    return (
      <>
        <div className={styles.resultPair}>
          <ClubCard label="Born to" name={born.name} color={born.color} note="Not on our list yet" />
          <ClubCard label="Built for" name={built.name} color={built.color} percentage={built.percentage} />
        </div>
        <p className={styles.line}>We can&apos;t score {born.name} yet, so your swipes decide.</p>
      </>
    );
  }

  if (outcome.same) {
    return (
      <ClubCard label="Your FC, by blood and by heart" name={built.name} color={built.color} percentage={built.percentage} />
    );
  }

  const line =
    outcome.leanWinner === "born"
      ? `Your roots outweigh your swipes, so ${born.name} stays home.`
      : `Your swipes outweigh your roots, so ${built.name} is where you fit.`;

  return (
    <>
      <div className={styles.resultPair}>
        <ClubCard label="Born to" name={born.name} color={born.color} percentage={born.percentage} />
        <ClubCard label="Built for" name={built.name} color={built.color} percentage={built.percentage} />
      </div>
      <p className={styles.line}>{line}</p>
    </>
  );
}

/**
 * @param {{ label: string, name: string, color?: string|null, percentage?: number|null, note?: string }} props
 */
function ClubCard({ label, name, color, percentage, note }) {
  return (
    <div className={styles.arrivalBand} style={{ "--club": color || "#D8232A" }}>
      <p className={styles.resultLabel}>{label}</p>
      <h1 className={styles.arrivalName}>{name}</h1>
      {note ? <p className={styles.arrivalMeta}>{note}</p> : null}
      {percentage != null ? <p className={styles.arrivalScore}>{percentage}% match</p> : null}
    </div>
  );
}

/**
 * @param {ReturnType<typeof buildOutcome>} outcome
 */
function heroOf(outcome) {
  if (!outcome.built) return null;
  if (!outcome.born || outcome.born.typed || outcome.same || outcome.noRoots) return outcome.built;
  if (outcome.leanWinner === "born") return outcome.born;
  return outcome.built;
}
