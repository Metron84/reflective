"use client";

import Link from "next/link";
import { useMemo } from "react";
import { pickNextUp } from "@/lib/account/next-up";
import { useReveals } from "./RevealsProvider";
import styles from "./NextUp.module.css";

/**
 * Priority 2 follows the live reveal state, so a tap in the Crest tile updates this card
 * at once. Everything else is decided on the server from each game's own table.
 *
 * @param {{quizOpen: boolean, codemasterInProgress: boolean, competitions: string[]}} props
 */
export default function NextUp({ quizOpen, codemasterInProgress, competitions }) {
  const { revealed } = useReveals();
  const next = useMemo(() => {
    const unrevealed = competitions.filter((c) => !revealed.includes(c)).length;
    return pickNextUp({ quizOpen, unrevealed, codemasterInProgress });
  }, [revealed, competitions, quizOpen, codemasterInProgress]);

  function scroll(event) {
    const target = next.scrollTo && document.getElementById(next.scrollTo);
    if (!target) return;
    event.preventDefault();
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
  }

  return (
    <section className={styles.card} aria-label="Next up">
      <p className={styles.label}>Next up</p>
      <p className={styles.title}>{next.title}</p>
      {next.scrollTo ? (
        <a href={next.href} onClick={scroll} className={styles.cta}>
          {next.cta}
        </a>
      ) : (
        <Link href={next.href} className={styles.cta}>
          {next.cta}
        </Link>
      )}
    </section>
  );
}
