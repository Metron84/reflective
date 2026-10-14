"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { pickNextUp } from "@/lib/account/next-up";
import { parseRevealed, revealSnapshot, subscribeReveals } from "@/lib/crest/reveal-store";
import styles from "./NextUp.module.css";

/**
 * Reveal state lives in the browser, so priority 2 is decided here. Everything else
 * is decided on the server from each game's own table.
 *
 * @param {{userId: string, quizOpen: boolean, codemasterInProgress: boolean, savedAt: string|null, competitions: string[]}} props
 */
export default function NextUp({ userId, quizOpen, codemasterInProgress, savedAt, competitions }) {
  const raw = useSyncExternalStore(
    subscribeReveals,
    () => revealSnapshot(userId),
    () => ""
  );
  const next = useMemo(() => {
    const revealed = new Set(savedAt ? parseRevealed(raw, savedAt) : []);
    const unrevealed = competitions.filter((c) => !revealed.has(c)).length;
    return pickNextUp({ quizOpen, unrevealed, codemasterInProgress });
  }, [raw, savedAt, competitions, quizOpen, codemasterInProgress]);

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
