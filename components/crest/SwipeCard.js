"use client";

import { useEffect, useRef, useState } from "react";
import { allowsBoth } from "@/lib/crest/cards";
import styles from "./CrestSwipe.module.css";

const COMMIT_PX = 90;
const STAMP_PX = 20;
const FLICK = 0.5;
const FLY_MS = 320;
const HINT_KEY = "crest:hintSeen";

function labelOf(card, side) {
  if (side === "both") return "Both";
  return side === "left" ? card.leftLabel || card.left : card.rightLabel || card.right;
}

/**
 * The swipe card. Question lives on the card. Facet names stay off screen.
 * Left or right. Up for Both only when the card allows it.
 *
 * @param {{
 *   card: import("@/lib/crest/cards").CrestCard,
 *   index: number,
 *   onAnswer: (side: "left"|"right"|"both") => void,
 *   onDrag: (progress: number) => void,
 * }} props
 */
export default function SwipeCard({ card, index, onAnswer, onDrag }) {
  const [dx, setDx] = useState(0);
  const [dy, setDy] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [flying, setFlying] = useState(null);
  const [hint, setHint] = useState(false);
  const [hintText, setHintText] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const lastX = useRef(0);
  const lastY = useRef(0);
  const lastT = useRef(0);
  const velocityX = useRef(0);
  const velocityY = useRef(0);
  const pointerId = useRef(null);
  const committed = useRef(false);

  useEffect(() => {
    if (index !== 0) return undefined;
    try {
      if (window.localStorage.getItem(HINT_KEY) === "1") {
        return undefined;
      }
    } catch {
      /* ignore */
    }
    setHintText(true);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return undefined;
    const id = window.setTimeout(() => setHint(true), 600);
    return () => window.clearTimeout(id);
  }, [index]);

  const bothOk = allowsBoth(card);

  function markHintSeen() {
    setHint(false);
    setHintText(false);
    try {
      window.localStorage.setItem(HINT_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  function commit(side) {
    if (committed.current) return;
    if (side === "both" && !bothOk) return;
    committed.current = true;
    markHintSeen();
    setDragging(false);
    setFlying(side);
    onDrag(side === "left" ? -1 : side === "right" ? 1 : 0);
    window.setTimeout(() => onAnswer(side), FLY_MS);
  }

  function onPointerDown(event) {
    if (flying) return;
    pointerId.current = event.pointerId;
    startX.current = event.clientX;
    startY.current = event.clientY;
    lastX.current = event.clientX;
    lastY.current = event.clientY;
    lastT.current = performance.now();
    velocityX.current = 0;
    velocityY.current = 0;
    setDragging(true);
    setHint(false);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event) {
    if (!dragging || event.pointerId !== pointerId.current) return;
    const now = performance.now();
    const dt = now - lastT.current;
    if (dt > 0) {
      velocityX.current = (event.clientX - lastX.current) / dt;
      velocityY.current = (event.clientY - lastY.current) / dt;
    }
    lastX.current = event.clientX;
    lastY.current = event.clientY;
    lastT.current = now;
    const nextX = event.clientX - startX.current;
    const nextY = event.clientY - startY.current;
    setDx(nextX);
    setDy(nextY);
    onDrag(Math.max(-1, Math.min(1, nextX / COMMIT_PX)));
    if (Math.abs(nextX) > 4 || Math.abs(nextY) > 4) markHintSeen();
  }

  function onPointerUp(event) {
    if (!dragging || event.pointerId !== pointerId.current) return;
    setDragging(false);
    const flickLeft = velocityX.current <= -FLICK;
    const flickRight = velocityX.current >= FLICK;
    const flickUp = bothOk && velocityY.current <= -FLICK;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (bothOk && absY >= absX && dy < 0 && (dy <= -COMMIT_PX || flickUp)) commit("both");
    else if (dx <= -COMMIT_PX || flickLeft) commit("left");
    else if (dx >= COMMIT_PX || flickRight) commit("right");
    else {
      setDx(0);
      setDy(0);
      onDrag(0);
    }
  }

  const stamp = (side) => {
    if (side === "both" && !bothOk) return 0;
    const travel = side === "left" ? -dx : side === "right" ? dx : -dy;
    if (travel <= STAMP_PX) return 0;
    return Math.min(1, (travel - STAMP_PX) / (COMMIT_PX - STAMP_PX));
  };

  const flyX = flying === "left" ? -1.6 : flying === "right" ? 1.6 : 0;
  const flyY = flying === "both" ? -1.4 : 0;
  const liveY = dragging && bothOk ? Math.min(0, dy) : 0;
  const translate = flying
    ? `translate(${flyX * 100}vw, ${flyY * 100}vh)`
    : `translate(${dx}px, ${liveY}px)`;
  const rotate = flying === "both" ? 0 : flying ? flyX * 18 : dx / 18;
  const spring = !dragging && !flying;
  const transition = dragging
    ? "none"
    : flying
      ? `transform ${FLY_MS}ms cubic-bezier(0.2, 0.7, 0.3, 1), opacity ${FLY_MS}ms ease`
      : spring
        ? "transform 200ms cubic-bezier(0.2, 0.9, 0.3, 1.2)"
        : "none";

  const leftHot = dx < -STAMP_PX || flying === "left";
  const rightHot = dx > STAMP_PX || flying === "right";
  const bothHot = bothOk && (dy < -STAMP_PX || flying === "both");

  return (
    <div className={styles.cardWrap}>
      <div className={hint ? styles.cardHint : undefined}>
      <div
        className={styles.card}
        role="group"
        aria-label={`Card ${index + 1}. ${card.question}`}
        style={{
          transform: `${translate} rotate(${rotate}deg)`,
          transition,
          opacity: flying ? 0 : 1,
          cursor: dragging ? "grabbing" : "grab",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <p className={styles.cardQuestion}>{card.question}</p>
        {card.context ? <p className={styles.cardOnContext}>{card.context}</p> : null}
        <div
          className={`${styles.stamp} ${styles.stampLeft}`}
          style={{ opacity: stamp("left") }}
          aria-hidden="true"
        >
          {labelOf(card, "left")}
        </div>
        <div
          className={`${styles.stamp} ${styles.stampRight}`}
          style={{ opacity: stamp("right") }}
          aria-hidden="true"
        >
          {labelOf(card, "right")}
        </div>
        {bothOk ? (
          <div
            className={`${styles.stamp} ${styles.stampBoth}`}
            style={{ opacity: stamp("both") }}
            aria-hidden="true"
          >
            Both
          </div>
        ) : null}
        <div className={styles.cardPoles} aria-hidden="true">
          <span className={leftHot ? styles.poleHot : rightHot || bothHot ? styles.poleDim : undefined}>
            <ArrowOut left />
            {labelOf(card, "left")}
          </span>
          {bothOk ? (
            <span className={bothHot ? styles.poleHot : leftHot || rightHot ? styles.poleDim : undefined}>
              Both
            </span>
          ) : null}
          <span className={rightHot ? styles.poleHot : leftHot || bothHot ? styles.poleDim : undefined}>
            {labelOf(card, "right")}
            <ArrowOut />
          </span>
        </div>
      </div>
      </div>

      <p
        className={`${styles.swipeHint} ${hintText ? "" : styles.swipeHintHidden}`}
        aria-hidden={!hintText}
      >
        <Arrows both={bothOk} />
        {bothOk ? "Swipe left, right, or up for both" : "Swipe left or right."}
      </p>

      <div className={styles.choiceStack}>
        {bothOk ? (
          <button
            type="button"
            data-choice="both"
            className={styles.choiceBoth}
            onClick={() => commit("both")}
            disabled={Boolean(flying)}
          >
            Both
          </button>
        ) : null}
        <div className={styles.choiceRow}>
          <button
            type="button"
            data-choice="left"
            className={styles.choice}
            onClick={() => commit("left")}
            disabled={Boolean(flying)}
          >
            <ArrowOut left />
            {labelOf(card, "left")}
          </button>
          <button
            type="button"
            data-choice="right"
            className={styles.choice}
            onClick={() => commit("right")}
            disabled={Boolean(flying)}
          >
            {labelOf(card, "right")}
            <ArrowOut />
          </button>
        </div>
      </div>
    </div>
  );
}

function ArrowOut({ left = false }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      {left ? (
        <path d="M7.5 2.5 3.5 6l4 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      ) : (
        <path d="M4.5 2.5 8.5 6l-4 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      )}
    </svg>
  );
}

function Arrows({ both = true }) {
  if (!both) {
    return (
      <svg width="28" height="12" viewBox="0 0 28 12" fill="none" aria-hidden="true">
        <path d="M8 2 3 6l5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M20 2 25 6l-5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="36" height="12" viewBox="0 0 36 12" fill="none" aria-hidden="true">
      <path d="M8 2 3 6l5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M18 9 18 3 M15.5 5 18 3 20.5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M28 2 33 6l-5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
