"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { darkenHex } from "@the-crest/lib/color-utils";
import { resolveClubGround } from "@the-crest/lib/club-ground-meta";
import { crowdShapesForClub, starsForClub } from "@the-crest/lib/ground/scene-stars";
import { SKYLINE_PATHS, STADIUM_PATH } from "@the-crest/lib/ground/skyline-paths";
import { shareArrivalFromClub } from "@the-crest/lib/arrival-share-card";
import { describeMatchClub } from "@the-crest/lib/tier";
import styles from "./GroundScene.module.css";

const MOBILE_VIEW = "0 0 390 844";
const DESKTOP_VIEW = "-195 0 780 844";
/**
 * @param {{ club: object | null; interactive?: boolean; sceneOnly?: boolean }} props
 */
export default function GroundScene({
  club,
  interactive = false,
  sceneOnly = false,
}) {
  const ground = useMemo(() => resolveClubGround(club || {}), [club]);
  const displayName = club ? describeMatchClub(club) : "Your club";
  const stars = useMemo(() => starsForClub(club?.slug || ""), [club?.slug]);
  const crowd = useMemo(
    () => crowdShapesForClub(club?.slug || "", ground.primary),
    [club?.slug, ground.primary],
  );

  const skylinePath = SKYLINE_PATHS[/** @type {1|2|3|4|5|6} */ (ground.skylineVariant)] || SKYLINE_PATHS[1];
  const skylineFill = darkenHex(ground.primary, 0.4);

  const [viewBox, setViewBox] = useState(MOBILE_VIEW);
  const [parallax, setParallax] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [shareState, setShareState] = useState("idle");
  const touchRef = useRef({ x: 0, active: false });

  async function onShare() {
    if (shareState === "working") return;
    setShareState("working");
    try {
      await shareArrivalFromClub(club);
      setShareState("idle");
    } catch (err) {
      if (err?.name === "AbortError") {
        setShareState("idle");
        return;
      }
      setShareState("error");
    }
  }

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mql.matches);
    const onChange = () => setReduceMotion(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    function syncView() {
      setViewBox(window.innerWidth >= 760 ? DESKTOP_VIEW : MOBILE_VIEW);
    }
    syncView();
    window.addEventListener("resize", syncView);
    return () => window.removeEventListener("resize", syncView);
  }, []);

  useEffect(() => {
    if (reduceMotion) return undefined;

    function onOrient(e) {
      const gamma = typeof e.gamma === "number" ? e.gamma : 0;
      setParallax(Math.max(-1, Math.min(1, gamma / 45)));
    }

    function onWheel(e) {
      setParallax((p) => Math.max(-1, Math.min(1, p + e.deltaY * 0.002)));
    }

    function onTouchStart(e) {
      if (!e.touches[0]) return;
      touchRef.current = { x: e.touches[0].clientX, active: true };
    }

    function onTouchMove(e) {
      if (!touchRef.current.active || !e.touches[0]) return;
      const dx = e.touches[0].clientX - touchRef.current.x;
      touchRef.current.x = e.touches[0].clientX;
      setParallax((p) => Math.max(-1, Math.min(1, p + dx * 0.004)));
    }

    function onTouchEnd() {
      touchRef.current.active = false;
    }

    window.addEventListener("deviceorientation", onOrient, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);

    return () => {
      window.removeEventListener("deviceorientation", onOrient);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [reduceMotion]);

  const skyShift = parallax * 8;
  const crowdShift = parallax * -16;
  const gradId = `sky-${club?.slug || "default"}`;
  const glowId = `glow-${club?.slug || "default"}`;

  return (
    <div className={`${styles.wrap} ${interactive ? styles.wrapInteractive : ""}`}>
      <svg
        className={styles.svg}
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        role="img"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0A111F" />
            <stop offset="100%" stopColor={ground.secondary} />
          </linearGradient>
          <radialGradient id={glowId} cx="50%" cy="45%" r="45%">
            <stop offset="0%" stopColor="rgb(242 237 228 / 0.35)" />
            <stop offset="55%" stopColor="rgb(242 237 228 / 0.08)" />
            <stop offset="100%" stopColor="rgb(242 237 228 / 0)" />
          </radialGradient>
        </defs>

        <rect width="780" height="844" x="-195" fill={`url(#${gradId})`} />

        <g opacity="0.9">
          {stars.map((s, i) => (
            <circle
              key={i}
              cx={s.cx}
              cy={s.cy}
              r={s.r}
              fill="#F2EDE4"
              opacity={s.o}
            />
          ))}
        </g>

        <g transform={`translate(${skyShift} 0)`}>
          <path d={skylinePath} fill={skylineFill} />
          {viewBox === DESKTOP_VIEW ? (
            <>
              <path d={skylinePath} fill={skylineFill} transform="translate(-390 0)" />
              <path d={skylinePath} fill={skylineFill} transform="translate(390 0)" />
            </>
          ) : null}
        </g>

        <path d={STADIUM_PATH} fill={ground.primary} />

        <ellipse cx="195" cy="400" rx="130" ry="36" fill={`url(#${glowId})`} />

        <g transform={`translate(${crowdShift} 0)`}>
          {crowd.map((c, i) => (
            <path key={i} d={c.d} fill={c.fill} opacity={0.92} />
          ))}
        </g>
      </svg>

      {sceneOnly ? null : (
      <div
        className={`${styles.overlay} ${interactive ? styles.overlayInteractive : ""}`}
      >
        {club?.badge_url ? (
          <img
            src={club.badge_url}
            alt=""
            className={styles.badge}
            width={112}
            height={112}
          />
        ) : null}
        <h1
          className={`${styles.title} ${club?.badge_url ? styles.titleWithBadge : ""}`}
        >
          {displayName}
        </h1>
        <p className={styles.welcome}>Welcome to {ground.city}</p>
        <p className={styles.stadium}>{ground.stadiumName}</p>
        <div className={styles.shareRow}>
          <button
            type="button"
            className={styles.shareBtn}
            disabled={shareState === "working"}
            aria-busy={shareState === "working"}
            aria-label="Share your club as an image"
            onClick={onShare}
          >
            {shareState === "working" ? (
              <>
                <span className={styles.spinner} aria-hidden="true" />
                Preparing…
              </>
            ) : (
              "Share your club"
            )}
          </button>
          {shareState === "error" ? (
            <p className={styles.shareError} role="status">
              Could not share. Try again or check your downloads folder.
            </p>
          ) : null}
        </div>
      </div>
      )}
    </div>
  );
}
