"use client";

import Link from "next/link";
import { useReveals } from "./RevealsProvider";
import styles from "./CrestTile.module.css";

/**
 * @param {{
 *   crest: {clubName: string, roomPct: number}|null,
 *   leagues: {savedAt: string, leagues: object[], clubs?: object[]}|null,
 * }} props
 */
export default function CrestTile({ crest, leagues }) {
  const rows = leagues?.leagues ?? [];
  const clubs = leagues?.clubs ?? [];
  const regions = rows.some((row) => typeof row.percentage === "number");
  const { revealed, reveal } = useReveals();

  return (
    <article id="crest-tile" className={`${styles.tile} ${crest ? "" : styles.quiet}`}>
      <h3 className={styles.name}>Find Your FC</h3>

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
                const wide = row.competition === "Rest of the World";
                return (
                  <li key={row.competition} className={wide ? styles.wide : undefined}>
                    {open ? (
                      wide && row.ranked ? (
                        <div className={styles.rotw}>
                          <p className={styles.leagueName}>{row.label}</p>
                          <ol className={styles.rank}>
                            {row.ranked.map((club, index) => (
                              <li
                                key={club.slug}
                                style={{
                                  background: club.primary,
                                  color: club.text,
                                  borderLeftColor: club.secondary,
                                }}
                              >
                                <span className={styles.pos}>{index + 1}</span>
                                <Badge url={club.badge_url} />
                                {club.flag ? (
                                  <span className={styles.flag} aria-hidden="true">
                                    {club.flag}
                                  </span>
                                ) : null}
                                <span className={styles.copy}>
                                  <span className={styles.club} style={{ color: club.text }}>
                                    {club.name}
                                  </span>
                                  <span className={styles.meta} style={{ color: club.text }}>
                                    {club.country}
                                  </span>
                                </span>
                                <span className={styles.pct}>{club.percentage}%</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      ) : (
                        <div
                          className={styles.revealed}
                          style={{
                            background: row.primary,
                            color: row.text,
                            borderLeftColor: row.secondary,
                          }}
                        >
                          <Badge url={row.badge_url} />
                          {row.flag ? (
                            <span className={styles.flag} aria-hidden="true">
                              {row.flag}
                            </span>
                          ) : null}
                          <span className={styles.copy}>
                            <span className={styles.leagueName} style={{ color: row.text }}>
                              {row.label}
                            </span>
                            <span className={styles.club}>{row.clubName}</span>
                          </span>
                          {typeof row.percentage === "number" ? (
                            <span className={styles.pct}>{row.percentage}%</span>
                          ) : null}
                        </div>
                      )
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

          {regions && clubs.length > 0 ? (
            <details className={styles.all}>
              <summary>All your matches</summary>
              <ol className={styles.matches}>
                {clubs.map((club) => (
                  <li key={club.slug}>
                    <span>{club.name}</span>
                    <span className={styles.pct}>{club.percentage}%</span>
                  </li>
                ))}
              </ol>
            </details>
          ) : null}
        </>
      ) : (
        <p className={styles.empty}>Swipe Find Your FC to unlock your regions</p>
      )}

      <Link href="/crest" className={styles.cta}>
        {crest ? "Swipe again" : "Play your first"}
      </Link>
    </article>
  );
}

function Badge({ url }) {
  if (!url) return null;
  return (
    <span className={styles.badge}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" width={40} height={40} loading="lazy" decoding="async" />
    </span>
  );
}
