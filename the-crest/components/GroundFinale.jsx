"use client";

import GroundScene from "@the-crest/components/GroundScene";
import InstallPrompt from "@the-crest/components/crest/InstallPrompt";
import { resolveClubGround } from "@the-crest/lib/club-ground-meta";
import { strengthTierLine } from "@the-crest/lib/fit";
import { pillarReasonBlocks } from "@the-crest/lib/reason";
import { remapTargets } from "@the-crest/lib/scope";
import { sensoryParagraph } from "@the-crest/lib/senses";
import { describeMatchClub } from "@the-crest/lib/tier";
import styles from "./GroundFinale.module.css";

/**
 * @param {{
 *   club: object | null;
 *   match?: { percent?: number; composition?: object } | null;
 *   countryFits?: { id: string; label: string; match: { club: object; percent?: number } }[];
 *   sensesAnswers?: (number|null)[];
 *   scores?: (number|null)[];
 *   leagueScope?: string;
 *   onRestart: () => void;
 *   onRemap?: (scope: string) => void;
 * }} props
 */
export default function GroundFinale({
  club,
  match = null,
  countryFits = [],
  sensesAnswers = [],
  scores = [],
  leagueScope = "all",
  onRestart,
  onRemap,
}) {
  const ground = resolveClubGround(club || {});
  const displayName = club ? describeMatchClub(club) : "Your club";
  const percent = typeof match?.percent === "number" ? match.percent : null;
  const tierLine =
    percent == null ? null : strengthTierLine(percent);
  const reasons = club
    ? pillarReasonBlocks(
        /** @type {number[]} */ (
          scores.map((s) => (s == null ? 4 : s))
        ),
        club,
      )
    : [];
  const maps = remapTargets(leagueScope);

  return (
    <div className={styles.root} role="region" aria-label="Your club">
      <GroundScene club={club} interactive sceneOnly />
      <div className={styles.board}>
        {club?.badge_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={club.badge_url} alt="" className={styles.badge} />
        ) : (
          <span
            className={styles.badgeFallback}
            style={{
              background: ground.primary,
              boxShadow: `inset 0 0 0 3px ${ground.secondary}`,
            }}
            aria-hidden="true"
          />
        )}
        <h1 className={styles.title}>{displayName}</h1>
        {percent != null ? (
          <p className={styles.percent}>{percent}%</p>
        ) : null}
        {tierLine ? <p className={styles.tier}>{tierLine}</p> : null}
        <p className={styles.senses}>{sensoryParagraph(sensesAnswers)}</p>

        {reasons.length ? (
          <ul className={styles.reasons}>
            {reasons.map((block) => (
              <li key={block.pillar}>
                <span className={styles.reasonPillar}>{block.pillar}</span>
                <span>{block.line}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className={styles.remap}>
          <p className={styles.remapHeading}>Your club on another map</p>
          <div className={styles.remapRow}>
            {maps.map((item) => (
              <button
                key={item.id}
                type="button"
                className={styles.remapBtn}
                onClick={() => onRemap?.(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={onRestart}>
            Start again
          </button>
        </div>
      </div>
      <InstallPrompt show />
    </div>
  );
}
