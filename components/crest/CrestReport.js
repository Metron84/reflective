"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DEFAULT_ALPHA, arrivalSummary } from "@/lib/crest/engine";
import { buildReport, trait, REPORT_PHRASES, roomPercent } from "@/lib/crest/report";
import { crestSignupHref } from "@/lib/crest/signup";
import { cardDataFrom, renderShareCard, shareCard, shareKicker } from "@/lib/crest/shareCard";
import styles from "./CrestReport.module.css";

const GROUPS = ["Heart", "Mind", "Soul"];

const VIEW_CAPTION = {
  blend: "60% how they see themselves, 40% how others see them.",
  self: "Only the club's own voice.",
  others: "Only rivals, press and neutrals.",
};

/**
 * @param {{
 *   answers: import("@/lib/crest/engine").CrestAnswer[],
 *   group: string|null,
 *   colour: string|null,
 *   stake?: string|null,
 *   onBack: () => void,
 *   onRestart: () => void,
 * }} props
 */
export default function CrestReport({ answers, group, colour, stake = null, onBack, onRestart }) {
  const [view, setView] = useState("blend");
  const [ready, setReady] = useState(false);
  const [shareState, setShareState] = useState("idle");
  const result = useMemo(() => ({ answers, group, colour, stake }), [answers, group, colour, stake]);
  const blend = useMemo(() => buildReport(result, "blend"), [result]);
  const report = useMemo(() => buildReport(result, view), [result, view]);

  useEffect(() => {
    window.scrollTo(0, 0);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setReady(true);
      return;
    }
    const id = window.requestAnimationFrame(() => setReady(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!answers.length) onBack();
  }, [answers.length, onBack]);

  if (!blend || !report) return null;

  const { club } = blend;
  const place = [club.city, club.country].filter(Boolean).join(", ");
  const meta = [place, club.stadium].filter(Boolean).join(" · ");
  const summary = arrivalSummary(answers, DEFAULT_ALPHA, { group, stake });
  const roomPct = roomPercent(summary.probability);
  const kicker = shareKicker(roomPct, summary.confident);

  async function share() {
    if (shareState === "busy") return;
    setShareState("busy");
    try {
      const blob = await renderShareCard(cardDataFrom(summary, roomPct, kicker));
      const outcome = await shareCard(blob, club.name);
      setShareState(outcome === "saved" ? "saved" : "idle");
    } catch {
      setShareState("idle");
    }
  }

  return (
    <article className={styles.report} data-ready={ready ? "true" : "false"}>
      <button type="button" className={styles.back} onClick={onBack}>
        <ArrowLeft />
        Back to your result
      </button>

      <section className={styles.opener}>
        <p className={`${styles.kicker} ${styles.kickerRed}`}>The full report</p>
        <h1 className={styles.title}>{club.name}</h1>
        {meta ? <p className={styles.meta}>{meta}</p> : null}
        {blend.stakeLine ? <p className={styles.meta}>{blend.stakeLine}</p> : null}
        <p className={styles.lead}>{blend.opener}</p>
        {blend.voiceLine ? <blockquote className={styles.voice}>{blend.voiceLine}</blockquote> : null}
        <p className={styles.match}>{blend.roomPct}% match</p>
      </section>

      <section className={styles.section}>
        <p className={styles.kicker}>Heart, mind, soul</p>
        <h2 className={styles.heading}>Where you meet.</h2>
        <div className={styles.legend}>
          <span>
            <i className={styles.youDot} /> You
          </span>
          <span>
            <i className={styles.themRing} /> {club.shortName}
          </span>
        </div>
        <div className={styles.groups}>
          {GROUPS.map((groupName) => {
            const rows = report.facets.filter((f) => f.group === groupName);
            if (!rows.length) return null;
            return (
              <div key={groupName} className={styles.group}>
                <h3 className={styles.groupTitle}>{groupName}</h3>
                {rows.map((facet) => (
                  <FacetTrack key={facet.id} facet={facet} clubName={club.shortName} />
                ))}
              </div>
            );
          })}
        </div>
      </section>

      <section className={`${styles.verdict} ${report.rub ? styles.verdictRub : ""}`}>
        <p className={styles.kicker}>The verdict</p>
        <p className={styles.verdictLine}>{report.verdict}</p>
      </section>

      <div className={styles.lower}>
        <section className={styles.voices}>
          <p className={styles.kicker}>Two voices</p>
          <h2 className={styles.headingSmall}>Whose view of the club?</h2>
          <div className={styles.segment} role="group" aria-label="Club voice">
            <ViewButton active={view === "blend"} onClick={() => setView("blend")}>
              Blend
            </ViewButton>
            <ViewButton active={view === "self"} onClick={() => setView("self")}>
              Their words
            </ViewButton>
            <ViewButton active={view === "others"} onClick={() => setView("others")}>
              Rival eyes
            </ViewButton>
          </div>
          <div className={styles.captionRow}>
            <p className={styles.caption}>{VIEW_CAPTION[view]}</p>
            <p className={styles.viewPct}>{report.matchPct}%</p>
          </div>
        </section>

        <section className={styles.section}>
          <p className={styles.kicker}>Across the map</p>
          <h2 className={styles.heading}>Your club in every league.</h2>
          <ul className={styles.leagues}>
            {blend.leagues.map((row) => (
              <li key={row.group}>
                <span className={styles.leagueName}>{row.league}</span>
                <span className={styles.leagueClub}>
                  {row.clubName}
                  {row.isTop ? <small>Your match</small> : null}
                </span>
                <span className={styles.leaguePct}>{row.matchPct}%</span>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section}>
          <p className={styles.kicker}>Close behind</p>
          <h2 className={styles.heading}>And why not them.</h2>
          {blend.clusterLine ? <p className={styles.cluster}>{blend.clusterLine}</p> : null}
          <ul className={styles.behind}>
            {blend.closeBehind.map((row) => (
              <li key={row.name}>
                <div className={styles.behindTop}>
                  <span className={styles.dot} style={{ background: row.dotColor }} />
                  <strong>{row.name}</strong>
                  <span>{row.matchPct}%</span>
                </div>
                {row.reason ? <p className={styles.reason}>{row.reason}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.share} onClick={share} disabled={shareState === "busy"}>
          {shareState === "saved" ? "Card saved, link copied" : "Share my crest"}
        </button>
        <Link href={crestSignupHref(club.slug)} className={styles.ghost}>
          Join The Reflective Football
        </Link>
        <button type="button" className={styles.outline} onClick={onRestart}>
          Swipe again
        </button>
        <Link href="/films" className={styles.ghost}>
          Watch the films
        </Link>
      </div>
    </article>
  );
}

function ViewButton({ active, onClick, children }) {
  return (
    <button type="button" className={active ? styles.segOn : styles.seg} aria-pressed={active} onClick={onClick}>
      {children}
    </button>
  );
}

function FacetTrack({ facet, clubName }) {
  const phrase = REPORT_PHRASES[facet.index];
  const youLabel = trait(phrase, facet.you);
  const themLabel = trait(phrase, facet.them);
  const left = Math.min(facet.youPos, facet.themPos);
  const width = Math.abs(facet.youPos - facet.themPos);
  const gapClass =
    facet.tag === "Shared" ? styles.gapShared : facet.tag === "The rub" ? styles.gapRub : styles.gap;

  return (
    <div className={styles.facet}>
      <div className={styles.facetHead}>
        <span className={styles.facetName}>{facet.name}</span>
        <span
          className={
            facet.tag === "The rub"
              ? styles.tagRub
              : facet.tag === "Shared"
                ? styles.tagShared
                : styles.tagMute
          }
        >
          {facet.tag}
        </span>
      </div>
      <div
        className={styles.track}
        aria-label={`${facet.name}: you ${youLabel}, ${clubName} ${themLabel}`}
      >
        <span className={styles.trackLine} aria-hidden="true" />
        <span className={styles.trackTick} aria-hidden="true" />
        <span
          className={gapClass}
          aria-hidden="true"
          style={{ left: `${left}%`, width: `${width}%` }}
        />
        <span
          className={styles.themMark}
          aria-hidden="true"
          style={{ "--pos": `${facet.themPos}%` }}
        />
        <span
          className={styles.youMark}
          aria-hidden="true"
          style={{ "--pos": `${facet.youPos}%` }}
        />
      </div>
      <div className={styles.poles}>
        <span>{facet.leftLabel}</span>
        <span>{facet.rightLabel}</span>
      </div>
      {facet.swipeLine ? <p className={styles.swipe}>{facet.swipeLine}</p> : null}
    </div>
  );
}

function ArrowLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M11 3.5 5.5 9 11 14.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
