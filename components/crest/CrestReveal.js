"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_ALPHA, arrivalSummary } from "@/lib/crest/engine";
import { roomPercent } from "@/lib/crest/report";
import { bothText, cardDataFrom, renderShareCard, shareCard, shareKicker } from "@/lib/crest/shareCard";
import { stakeLine } from "@/lib/crest/stakes";
import styles from "./CrestReveal.module.css";

const SLIDE_MS = 5200;
const TAP_GUARD_MS = 700;

/**
 * Story-style reveal between the last swipe and the full result.
 * Tap right to go on, left to go back, hold to pause. The last slide is the
 * share card.
 *
 * @param {{
 *   answers: import("@/lib/crest/engine").CrestAnswer[],
 *   group: string|null,
 *   stake?: string|null,
 *   onDone: () => void,
 * }} props
 */
export default function CrestReveal({ answers, group, stake = null, onDone }) {
  const summary = useMemo(
    () => arrivalSummary(answers, DEFAULT_ALPHA, { group, stake }),
    [answers, group, stake],
  );
  const { club, probability, confident, runnerUp, greenFlags, rub } = summary;
  const roomPct = roomPercent(probability);
  const kicker = shareKicker(roomPct, confident);
  const place = [club.city, club.country].filter(Boolean).join(", ");
  const traits = greenFlags.map((f) => f.userPhrase).filter((p) => p && p !== "both");

  const slides = useMemo(() => {
    const list = [
      {
        key: "start",
        body: (
          <>
            <p className={styles.small}>Eighteen swipes later</p>
            <h2 className={styles.big}>You told us who you are.</h2>
            <p className={styles.line}>{stakeLine(stake) || "Now meet the club that sounds like you."}</p>
          </>
        ),
      },
    ];
    if (traits.length) {
      list.push({
        key: "you",
        body: (
          <>
            <p className={styles.small}>First, you</p>
            {traits.map((t) => (
              <h2 key={t} className={styles.big}>
                You&apos;re {t}.
              </h2>
            ))}
          </>
        ),
      });
    }
    if (rub) {
      list.push({
        key: "rub",
        body: (
          <>
            <p className={styles.accent}>The rub</p>
            <h2 className={styles.big}>One thing you&apos;ll argue about.</h2>
            <p className={styles.line}>
              You: {bothText(rub.userPhrase)}. Them: {bothText(rub.clubPhrase)}.
            </p>
          </>
        ),
      });
    }
    if (runnerUp) {
      list.push({
        key: "close",
        body: (
          <>
            <p className={styles.small}>It came down to two</p>
            <h2 className={styles.big}>{runnerUp.name} came close.</h2>
            <p className={styles.line}>But not close enough.</p>
          </>
        ),
      });
    }
    list.push({
      key: "club",
      tone: club.color || "#d8232a",
      body: (
        <>
          <p className={styles.accent}>{kicker}</p>
          <h2 className={styles.clubName}>{club.name}</h2>
          {place ? <p className={styles.line}>{place}</p> : null}
          <p className={styles.room}>{roomPct}% of the last room</p>
        </>
      ),
    });
    list.push({ key: "share", share: true });
    return list;
  }, [club, kicker, place, roomPct, rub, runnerUp, stake, traits]);

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduce, setReduce] = useState(false);
  const [card, setCard] = useState({ blob: null, url: null });
  const [shareState, setShareState] = useState("idle");
  const armedAt = useRef(0);
  const last = slides.length - 1;

  useEffect(() => {
    armedAt.current = Date.now() + TAP_GUARD_MS;
    setReduce(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    let url = null;
    let live = true;
    renderShareCard(cardDataFrom(summary, roomPct, kicker))
      .then((blob) => {
        if (!live) return;
        url = URL.createObjectURL(blob);
        setCard({ blob, url });
      })
      .catch(() => {});
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [summary, roomPct, kicker]);

  const go = useCallback(
    (step) => {
      if (Date.now() < armedAt.current) return;
      setIndex((i) => Math.max(0, Math.min(last, i + step)));
    },
    [last],
  );

  useEffect(() => {
    if (reduce || paused || index >= last) return;
    const id = window.setTimeout(() => setIndex((i) => Math.min(last, i + 1)), SLIDE_MS);
    return () => window.clearTimeout(id);
  }, [index, paused, reduce, last]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "ArrowRight" || e.key === " ") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "Escape") onDone();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onDone]);

  async function share() {
    if (!card.blob) return;
    setShareState("busy");
    const outcome = await shareCard(card.blob, club.name);
    setShareState(outcome === "saved" ? "saved" : "idle");
  }

  const slide = slides[index];

  return (
    <section
      className={styles.reveal}
      style={{ "--tone": slide.tone || "transparent" }}
      data-tone={slide.tone ? "club" : "night"}
      aria-roledescription="story"
      aria-label="Your Crest reveal"
    >
      <div className={styles.bars} aria-hidden="true">
        {slides.map((s, i) => (
          <span key={s.key} className={styles.bar}>
            <i
              className={i < index ? styles.fillDone : i === index ? styles.fillNow : ""}
              style={
                i === index
                  ? { animationDuration: `${SLIDE_MS}ms`, animationPlayState: paused || reduce ? "paused" : "running" }
                  : undefined
              }
            />
          </span>
        ))}
      </div>

      <div className={styles.top}>
        <span className={styles.brand}>The Crest</span>
        <button type="button" className={styles.skip} onClick={onDone}>
          {index === last ? "See everything" : "Skip"}
        </button>
      </div>

      {slide.share ? (
        <div className={styles.shareSlide}>
          <p className={styles.small}>Your card</p>
          <div className={styles.preview}>
            {card.url ? (
              <img src={card.url} alt={`Share card: ${kicker}, ${club.name}, ${roomPct}% of the last room`} />
            ) : (
              <span className={styles.drawing}>Drawing your card</span>
            )}
          </div>
          <div className={styles.shareActions}>
            <button type="button" className={styles.primary} onClick={share} disabled={!card.blob || shareState === "busy"}>
              {shareState === "saved" ? "Card saved, link copied" : "Share your crest"}
            </button>
            <button type="button" className={styles.secondary} onClick={onDone}>
              See everything
            </button>
          </div>
        </div>
      ) : (
        <>
          <div key={slide.key} className={styles.slide} aria-live="polite">
            {slide.body}
          </div>
          <button
            type="button"
            className={styles.zoneBack}
            aria-label="Previous"
            onClick={() => go(-1)}
            onPointerDown={() => setPaused(true)}
            onPointerUp={() => setPaused(false)}
            onPointerLeave={() => setPaused(false)}
          />
          <button
            type="button"
            className={styles.zoneNext}
            aria-label="Next"
            onClick={() => go(1)}
            onPointerDown={() => setPaused(true)}
            onPointerUp={() => setPaused(false)}
            onPointerLeave={() => setPaused(false)}
          />
          <p className={styles.hint}>{reduce ? "Tap to continue" : "Tap to skip ahead. Hold to pause."}</p>
        </>
      )}
    </section>
  );
}
