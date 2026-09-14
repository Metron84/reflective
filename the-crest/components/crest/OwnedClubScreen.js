"use client";

import { useMemo, useState } from "react";
import { groupClubsForOwnedPicker } from "@the-crest/lib/owned-club-groups";
import styles from "./OwnedClubScreen.module.css";

/**
 * @param {{
 *   clubs: { slug: string; name: string; competition?: string | null; tier?: string }[];
 *   onChooseClub: (slug: string) => void;
 *   onNoClub: () => void;
 *   onBack: () => void;
 * }} props
 */
export default function OwnedClubScreen({
  clubs,
  onChooseClub,
  onNoClub,
  onBack,
}) {
  const sections = useMemo(() => groupClubsForOwnedPicker(clubs), [clubs]);
  const [openId, setOpenId] = useState(/** @type {string | null} */ (null));

  return (
    <section className={styles.screen}>
      <h2 className={styles.q}>Do you already have a club?</h2>
      <p className={styles.hint}>
        We will not match you to a club you already carry.
      </p>

      <button type="button" className={styles.noClub} onClick={onNoClub}>
        No club yet
      </button>

      <div className={styles.leagues}>
        {sections.map((section) => {
          const open = openId === section.id;
          return (
            <div key={section.id} className={styles.league}>
              <button
                type="button"
                className={`${styles.leagueBtn} ${open ? styles.leagueOpen : ""}`}
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : section.id)}
              >
                <span>{section.label}</span>
                <span className={styles.chevron} aria-hidden="true">
                  {open ? "–" : "+"}
                </span>
              </button>
              {open ? (
                <div className={styles.clubList}>
                  {section.clubs.map((club) => (
                    <button
                      key={club.slug}
                      type="button"
                      className={styles.clubBtn}
                      onClick={() => onChooseClub(club.slug)}
                    >
                      {club.name}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <button type="button" className={styles.back} onClick={onBack}>
        Back
      </button>
    </section>
  );
}
