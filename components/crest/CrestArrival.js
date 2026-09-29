"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DEFAULT_ALPHA, arrivalSummary, colourMap, leagueMap, userVector } from "@/lib/crest/engine";
import { buildReport, closeBehindReason, roomPercent } from "@/lib/crest/report";
import { crestSignupHref } from "@/lib/crest/signup";
import styles from "./CrestSwipe.module.css";

const FAMILY_LABEL = {
  red: "red",
  blue: "blue",
  "sky blue": "sky blue",
  black: "black",
  yellow: "yellow",
  green: "green",
  orange: "orange",
  purple: "purple",
  pink: "pink",
  brown: "brown",
};

const FAMILY_SWATCH = {
  red: "#C8102E",
  blue: "#1C4E9D",
  "sky blue": "#6CABDD",
  black: "#111111",
  yellow: "#F2C400",
  green: "#0E7A3E",
  orange: "#F58025",
  purple: "#5B2A86",
  pink: "#E88FB4",
  brown: "#5A3A2A",
};

/**
 * @param {{
 *   answers: import("@/lib/crest/engine").CrestAnswer[],
 *   group: string|null,
 *   stake?: string|null,
 *   saveState?: "idle"|"saving"|"saved"|"error",
 *   saveMessage?: string,
 *   onSave?: () => void,
 *   onOpenReport: () => void,
 *   onRestart: () => void,
 * }} props
 */
export default function CrestArrival({
  answers,
  group,
  stake = null,
  saveState = "idle",
  saveMessage = "",
  onSave,
  onOpenReport,
  onRestart,
}) {
  const [openColour, setOpenColour] = useState(null);
  const [openLeague, setOpenLeague] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), 500);
    return () => window.clearTimeout(id);
  }, []);
  const options = useMemo(() => ({ group, stake }), [group, stake]);
  const summary = useMemo(() => arrivalSummary(answers, DEFAULT_ALPHA, options), [answers, options]);
  const rows = useMemo(() => colourMap(answers, DEFAULT_ALPHA, { group, stake }), [answers, group, stake]);
  const leagueRows = useMemo(() => leagueMap(answers, DEFAULT_ALPHA, { group, stake }), [answers, group, stake]);
  const report = useMemo(
    () => buildReport({ answers, group, colour: null, stake }, "blend"),
    [answers, group, stake],
  );
  const user = useMemo(() => userVector(answers, stake), [answers, stake]);

  const { club, probability, confident, runnerUp, greenFlags, rub } = summary;
  const roomPct = roomPercent(probability);
  const place = [club.city, club.country].filter(Boolean).join(", ");
  const topName = club.name;

  return (
    <section className={styles.arrival}>
      <p className={styles.kicker}>
        {roomPct < 80 ? "Closest match" : confident ? "Your club" : "You sit between two"}
      </p>

      <div className={styles.arrivalBand} style={{ "--club": club.color || "#D8232A" }}>
        <h1 className={styles.arrivalName}>{club.name}</h1>
        <p className={styles.arrivalMeta}>
          {place}
          {club.founded ? ` · ${club.founded}` : ""}
          {club.home ? ` · ${club.home}` : ""}
        </p>
        <p className={styles.arrivalScore}>{roomPct}% of the last room</p>
      </div>

      {!confident && runnerUp ? (
        <div className={styles.arrivalBand} style={{ "--club": runnerUp.color || "#F2EDE4" }}>
          <h2 className={styles.arrivalNameSecond}>{runnerUp.name}</h2>
          <p className={styles.arrivalMeta}>
            {[runnerUp.city, runnerUp.country].filter(Boolean).join(", ")}
          </p>
        </div>
      ) : null}

      {club.selfLine ? (
        <blockquote className={styles.line}>
          <span className={styles.lineWho}>How they see themselves</span>
          {club.selfLine}
        </blockquote>
      ) : null}
      {club.othersLine ? (
        <blockquote className={styles.line}>
          <span className={styles.lineWho}>How the game sees them</span>
          {club.othersLine}
        </blockquote>
      ) : null}

      <div className={styles.flags}>
        {greenFlags.map((flag) => (
          <div key={flag.card.id} className={styles.flag}>
            <span className={styles.flagTag}>Shared</span>
            <strong>{flag.card.question}</strong>
            <span>You both: {flag.clubPhrase}.</span>
          </div>
        ))}
        {rub ? (
          <div className={`${styles.flag} ${styles.flagRub}`}>
            <span className={styles.flagTag}>The rub</span>
            <strong>{rub.card.question}</strong>
            <span>
              You: {rub.userPhrase}. Them: {rub.clubPhrase}.
            </span>
          </div>
        ) : null}
      </div>

      <h2 className={styles.subhead}>If you bleed a colour</h2>
      <p className={styles.hintLeft}>Same last-room share as Your club.</p>
      <ul className={styles.colourRows}>
        {rows.map((row) => {
          const best = row.clubs[0];
          const open = openColour === row.family;
          return (
            <li key={row.family}>
              <button
                type="button"
                className={`${styles.colourRow} ${open ? styles.colourRowActive : ""}`}
                aria-expanded={open}
                onClick={() => setOpenColour(open ? null : row.family)}
              >
                <span className={styles.swatch} style={{ background: FAMILY_SWATCH[row.family] }} />
                <span className={styles.colourName}>{FAMILY_LABEL[row.family]}</span>
                <span className={styles.colourBest}>{best.club.name}</span>
                <span className={styles.colourPct}>{roomPercent(best.probability)}%</span>
              </button>
              <div className={`${styles.colourExpand} ${open ? styles.colourExpandOpen : ""}`}>
                <div>
                  {row.clubs.map((entry, i) => (
                    <div key={entry.club.slug} className={styles.colourClub}>
                      <span>{i + 1}</span>
                      <span>{entry.club.name}</span>
                      <span>{roomPercent(entry.probability)}%</span>
                      {entry.club.slug === club.slug ? null : (
                        <small>
                          {closeBehindReason(user, club, entry.club, DEFAULT_ALPHA, topName)}
                        </small>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <h2 className={styles.subhead}>Your club in every league</h2>
      <p className={styles.hintLeft}>Same last-room share. Highest club still standing in each league.</p>
      <ul className={styles.colourRows}>
        {leagueRows.map((row) => {
          const best = row.clubs[0];
          const open = openLeague === row.competition;
          return (
            <li key={row.competition}>
              <button
                type="button"
                className={`${styles.colourRow} ${styles.leagueRow} ${open ? styles.colourRowActive : ""}`}
                aria-expanded={open}
                onClick={() => setOpenLeague(open ? null : row.competition)}
              >
                <span className={styles.colourName}>{row.label}</span>
                <span className={styles.colourBest}>{best.club.name}</span>
                <span className={styles.colourPct}>{roomPercent(best.probability)}%</span>
              </button>
              <div className={`${styles.colourExpand} ${open ? styles.colourExpandOpen : ""}`}>
                <div>
                  {row.clubs.map((entry, i) => (
                    <div key={entry.club.slug} className={styles.colourClub}>
                      <span>{i + 1}</span>
                      <span>{entry.club.name}</span>
                      <span>{roomPercent(entry.probability)}%</span>
                      {entry.club.slug === club.slug ? null : (
                        <small>
                          {closeBehindReason(user, club, entry.club, DEFAULT_ALPHA, topName)}
                        </small>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {report ? (
        <div className={styles.reportCard}>
          <p className={styles.reportKicker}>The report</p>
          <h2 className={styles.reportTitle}>Why this club, and where you part.</h2>
          <p className={styles.reportOpener}>{report.opener}</p>
          <button type="button" className={styles.reportButton} onClick={onOpenReport}>
            Read the full report
            <ArrowRight />
          </button>
        </div>
      ) : null}

      <div className={styles.next}>
        {onSave ? (
          <button
            type="button"
            className={styles.saveCta}
            onClick={onSave}
            disabled={!ready || saveState === "saving" || saveState === "saved"}
          >
            {saveState === "saved" ? "Saved." : saveState === "saving" ? "Saving…" : "Save your results"}
          </button>
        ) : null}
        {saveMessage ? <p className={styles.saveNote}>{saveMessage}</p> : null}
        <button type="button" className={styles.again} onClick={onRestart}>
          Swipe again
        </button>
        <div className={styles.nextPair}>
          <Link href={crestSignupHref(club.slug)} className={styles.nextGhost}>
            Join The Reflective Football
          </Link>
          <Link href="/films" className={styles.nextGhost}>
            Watch the films
          </Link>
        </div>
      </div>
    </section>
  );
}

function ArrowRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M7 3.5 12.5 9 7 14.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
