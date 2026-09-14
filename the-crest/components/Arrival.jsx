"use client";

import { useEffect, useRef, useState } from "react";
import GroundScene from "@the-crest/components/GroundScene";
import styles from "./Arrival.module.css";

const WARP_MS = 1400;
const WHITEOUT_MS = 400;
const GROUND_MS = 800;
const REDUCED_MS = 300;
const WARP_PEAK = 14;

/** @param {number} t 0–1 */
function easeInOutCubic(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * @typedef {'idle' | 'warp' | 'whiteout' | 'ground'} ArrivalPhase
 */

/**
 * @typedef {Object} StarfieldControl
 * @property {number} opacity
 * @property {boolean} running
 * @property {number} warpMultiplier
 * @property {boolean} streak
 */

/**
 * @param {{
 *   club: object | null;
 *   onComplete: () => void;
 *   onStarfield: (patch: Partial<StarfieldControl>) => void;
 * }} props
 */
export default function Arrival({
  club,
  onComplete,
  onStarfield,
}) {
  const [phase, setPhase] = useState(/** @type {ArrivalPhase} */ ("idle"));
  const [reducedMotion, setReducedMotion] = useState(false);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const onStarfieldRef = useRef(onStarfield);

  onCompleteRef.current = onComplete;
  onStarfieldRef.current = onStarfield;

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mql.matches);
    const onChange = () => setReducedMotion(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    completedRef.current = false;
    setPhase("idle");

    let cancelled = false;
    /** @type {number[]} */
    const timers = [];
    let warpRaf = 0;
    let fadeRaf = 0;

    function finish() {
      if (completedRef.current || cancelled) return;
      completedRef.current = true;
      onStarfieldRef.current({
        running: false,
        opacity: 0,
        streak: false,
        warpMultiplier: 1,
      });
      onCompleteRef.current();
    }

    function schedule(ms, fn) {
      timers.push(window.setTimeout(fn, ms));
    }

    if (reducedMotion) {
      setPhase("ground");
      onStarfieldRef.current({
        running: true,
        opacity: 1,
        streak: false,
        warpMultiplier: 1,
      });
      const fadeStart = performance.now();
      function reducedFade(now) {
        if (cancelled) return;
        const t = Math.min(1, (now - fadeStart) / REDUCED_MS);
        onStarfieldRef.current({ opacity: 1 - t, running: t < 1 });
        if (t < 1) {
          fadeRaf = requestAnimationFrame(reducedFade);
        } else {
          finish();
        }
      }
      fadeRaf = requestAnimationFrame(reducedFade);
      return () => {
        cancelled = true;
        cancelAnimationFrame(fadeRaf);
        timers.forEach(clearTimeout);
      };
    }

    setPhase("warp");
    onStarfieldRef.current({
      running: true,
      opacity: 1,
      streak: true,
      warpMultiplier: 1,
    });

    const warpStart = performance.now();
    function warpFrame(now) {
      if (cancelled) return;
      const t = Math.min(1, (now - warpStart) / WARP_MS);
      const mult = 1 + (WARP_PEAK - 1) * easeInOutCubic(t);
      onStarfieldRef.current({
        warpMultiplier: mult,
        streak: true,
        running: true,
        opacity: 1,
      });
      if (t < 1) {
        warpRaf = requestAnimationFrame(warpFrame);
      } else {
        setPhase("whiteout");
        schedule(WHITEOUT_MS, () => {
          if (cancelled) return;
          setPhase("ground");
          onStarfieldRef.current({ streak: false });
          const groundStart = performance.now();
          function groundFade(now) {
            if (cancelled) return;
            const t = Math.min(1, (now - groundStart) / GROUND_MS);
            onStarfieldRef.current({ opacity: 1 - t, running: t < 0.98 });
            if (t < 1) {
              fadeRaf = requestAnimationFrame(groundFade);
            }
          }
          fadeRaf = requestAnimationFrame(groundFade);
          schedule(GROUND_MS, finish);
        });
      }
    }
    warpRaf = requestAnimationFrame(warpFrame);

    return () => {
      cancelled = true;
      cancelAnimationFrame(warpRaf);
      cancelAnimationFrame(fadeRaf);
      timers.forEach(clearTimeout);
    };
  }, [club?.slug, reducedMotion]);

  const overlayClass =
    phase === "whiteout"
      ? `${styles.overlay} ${styles.overlayWhite}`
      : phase === "ground"
        ? `${styles.overlay} ${styles.overlayWhite} ${styles.overlayClear}`
        : styles.overlay;

  const showGround = phase === "ground";

  return (
    <div className={styles.root} aria-hidden="true">
      {showGround ? (
        <div className={styles.ground}>
          <GroundScene club={club} />
        </div>
      ) : null}
      {!reducedMotion ? <div className={overlayClass} /> : null}
    </div>
  );
}
