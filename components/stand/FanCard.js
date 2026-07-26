"use client";

import styles from "./FanCard.module.css";

const BADGE_ORDER = ["club", "nation", "player"];
const CHAPTER_DAYS = 3;
const MARK = "❧";

function humanizeId(id) {
  if (!id) return "Unset";
  return String(id)
    .replace(/^nation-/, "")
    .replace(/^acf-/, "")
    .replace(/^ssc-/, "")
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Stable programme number from card state. Format PROGRAMME No. 0047 */
export function programmeNumberFromCard(cardState) {
  const raw = JSON.stringify({
    badges: cardState?.badges ?? null,
    activeBadge: cardState?.activeBadge ?? null,
    titles: {
      club: cardState?.titles?.club?.id,
      nation: cardState?.titles?.nation?.id,
      player: cardState?.titles?.player?.id,
    },
    stamps: cardState?.stamps ?? null,
    declarations: (cardState?.declarations || []).map((d) => d.order),
  });
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  }
  const n = (hash % 9999) + 1;
  return `PROGRAMME No. ${String(n).padStart(4, "0")}`;
}

function badgeLabel(cardState, scope) {
  const labels = cardState?.badgeLabels;
  if (labels?.[scope]) return labels[scope];
  if (scope === "club") return humanizeId(cardState?.badges?.clubId);
  if (scope === "nation") return humanizeId(cardState?.badges?.nationId);
  if (scope === "player") return humanizeId(cardState?.badges?.personId);
  return "Unset";
}

/**
 * Read-only Fan Card. Renders only the given cardState.
 * @param {{
 *   cardState: object,
 *   variant?: "full" | "compact",
 *   animateStampDay?: number | null,
 *   animateTitle?: boolean,
 * }} props
 */
export default function FanCard({
  cardState,
  variant = "full",
  animateStampDay = null,
  animateTitle = false,
}) {
  if (!cardState) return null;

  const activeBadge = BADGE_ORDER.includes(cardState.activeBadge)
    ? cardState.activeBadge
    : "club";
  const title =
    cardState.titles?.[activeBadge]?.label ||
    cardState.titles?.club?.label ||
    "Of This Stand";
  const earnedDays = new Set(cardState.stamps?.[activeBadge] || []);
  const declarations = cardState.declarations || [];
  const programme = programmeNumberFromCard(cardState);
  const isCompact = variant === "compact";
  const showUnclaimed = cardState.claimed === false;

  return (
    <article
      className={`${styles.card} ${isCompact ? styles.compact : ""}`}
      aria-label={`The Stand fan card, ${title}`}
    >
      {showUnclaimed ? (
        <span className={styles.unclaimed} aria-hidden>
          UNCLAIMED
        </span>
      ) : null}

      <header className={styles.masthead}>
        <p className={styles.standWord}>THE STAND</p>
        <p className={styles.programme}>{programme}</p>
      </header>

      <ul className={styles.badges} aria-label="Fan badges">
        {BADGE_ORDER.map((scope) => {
          const active = scope === activeBadge;
          return (
            <li key={scope}>
              <span
                className={`${styles.crest} ${active ? styles.crestActive : ""}`}
                title={scope}
              >
                <span className={styles.crestText}>
                  {badgeLabel(cardState, scope)}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      <h2
        className={`${styles.title} ${animateTitle ? styles.titleReveal : ""}`}
      >
        {title}
      </h2>

      {!isCompact ? (
        <>
          <div
            className={styles.stamps}
            aria-label={`Day stamps, ${earnedDays.size} of ${CHAPTER_DAYS} earned`}
          >
            {Array.from({ length: CHAPTER_DAYS }, (_, i) => {
              const day = i + 1;
              const earned = earnedDays.has(day);
              const isAnimTarget = animateStampDay === day;
              const showFilled = earned && !isAnimTarget;
              return (
                <span
                  key={`${day}-${isAnimTarget ? "anim" : "static"}`}
                  className={`${styles.stamp} ${
                    showFilled ? styles.stampFilled : ""
                  } ${isAnimTarget ? styles.stampFillAnim : ""}`}
                  aria-label={
                    earned || isAnimTarget
                      ? `Day ${day} earned`
                      : `Day ${day} remaining`
                  }
                />
              );
            })}
          </div>

          {declarations.length > 0 ? (
            <ul className={styles.declarations}>
              {declarations.map((d) => (
                <li key={`${d.order}-${d.choiceId}`} className={styles.declaration}>
                  <span className={styles.mark} aria-hidden>
                    {MARK}
                  </span>
                  <span className={styles.declarationText}>{d.label}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {cardState.pulse ? (
            <p className={styles.pulse}>{cardState.pulse}</p>
          ) : null}
        </>
      ) : null}
    </article>
  );
}
