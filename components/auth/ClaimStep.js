"use client";

import { useEffect, useRef } from "react";
import { claimAndContinue } from "@/lib/claim/run";
import { codemasterStep, crestStep, guesserStep, playStep } from "@/lib/claim/steps";
import { resolveContinue } from "@/lib/programme/links";
import { loadProgress, saveProgress } from "@/lib/codemaster/progress";
import { clearPendingSave, readPendingSave, saveCrestResult } from "@/lib/crest/save-client";
import styles from "./ClaimStep.module.css";

/**
 * Runs right after sign-in, before /welcome or /account. Saves what the player just earned,
 * then carries on. It always carries on: a failed claim never blocks the redirect.
 *
 * @param {{next: string, mainOrigin: string}} props
 */
export default function ClaimStep({ next, mainOrigin }) {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const steps = [
      playStep({ fetch }),
      guesserStep({ fetch }),
      codemasterStep({ fetch, load: loadProgress, save: saveProgress }),
      crestStep({ read: readPendingSave, save: saveCrestResult, clear: clearPendingSave }),
    ];
    claimAndContinue({
      steps,
      to: resolveContinue(next, window.location.host, mainOrigin),
      navigate: (to) => window.location.replace(to),
      timeoutMs: 6000,
    });
  }, [next, mainOrigin]);

  return (
    <div className={styles.wrap} role="status" aria-live="polite">
      <p className={styles.title}>Setting up your Programme</p>
      <p className={styles.note}>Saving what you just played.</p>
    </div>
  );
}
