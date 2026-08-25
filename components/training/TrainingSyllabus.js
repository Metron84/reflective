"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./TrainingSyllabus.module.css";

const MODULES = [
  {
    number: "01",
    title: "The Interview",
    lessons: [
      "Build trust in the first minute.",
      "Ask questions that open a story.",
      "Know when to stop filming.",
    ],
    capability:
      "You leave able to run an interview that produces a story, not a soundbite.",
    video: "/training/module-interview.mp4",
  },
  {
    number: "02",
    title: "Filming",
    lessons: [
      "Frame for the edit, not the moment.",
      "Capture clean audio in a live room.",
      "Move less. Gather what you will use.",
    ],
    capability:
      "You leave able to walk into an unpredictable room and come out with usable footage.",
    video: "/training/module-filming.mp4",
  },
  {
    number: "03",
    title: "The Edit",
    lessons: [
      "Find the emotional spine of the cut.",
      "Choose what earns a place. Cut the rest.",
      "Use sound with restraint.",
    ],
    capability:
      "You leave able to turn raw footage into a film someone watches to the end.",
    video: "/training/module-edit.mp4",
  },
  {
    number: "04",
    title: "Distribution",
    lessons: [
      "Match the film to the platform.",
      "Earn the opening seconds.",
      "Read the numbers. Decide the next cut.",
    ],
    capability:
      "You leave able to publish with intent rather than hope.",
    video: "/training/module-distribution.mp4",
  },
];

function getTrainingVideoRegistry() {
  if (!globalThis.__trfTrainingPageVideos) {
    globalThis.__trfTrainingPageVideos = new Set();
  }
  return globalThis.__trfTrainingPageVideos;
}

function SpeakerMutedIcon() {
  return (
    <svg className={styles.muteIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M5 9v6h4l5 5V4L9 9H5zm11.5 3 2.1-2.1 1.4 1.4L17.9 13.4l2.1 2.1-1.4 1.4L16.5 14.8l-2.1 2.1-1.4-1.4 2.1-2.1-2.1-2.1 1.4-1.4 2.1 2.1z"
      />
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg className={styles.muteIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M5 9v6h4l5 5V4L9 9H5zm11.66 0.17a4 4 0 0 1 0 5.66l1.41 1.41a6 6 0 0 0 0-8.48l-1.41 1.41zm2.83-2.83a8 8 0 0 1 0 11.32l1.41 1.41a10 10 0 0 0 0-14.14l-1.41 1.41z"
      />
    </svg>
  );
}

export function TrainingPageVideo({
  src,
  label,
  videoClassName,
  frameClassName,
}) {
  const videoRef = useRef(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return undefined;

    const entry = { el, setMuted };
    getTrainingVideoRegistry().add(entry);
    el.muted = true;

    return () => {
      getTrainingVideoRegistry().delete(entry);
    };
  }, []);

  function toggleMute(event) {
    event.stopPropagation();
    const el = videoRef.current;
    if (!el) return;

    const nextMuted = el.muted;
    if (nextMuted) {
      for (const entry of getTrainingVideoRegistry()) {
        if (entry.el !== el) {
          entry.el.muted = true;
          entry.setMuted(true);
        }
      }
      el.muted = false;
      setMuted(false);
      return;
    }

    el.muted = true;
    setMuted(true);
  }

  return (
    <div className={frameClassName}>
      <video
        ref={videoRef}
        className={videoClassName}
        src={src}
        muted
        loop
        autoPlay
        playsInline
        preload="metadata"
        aria-label={label}
      />
      <button
        type="button"
        className={styles.muteButton}
        onClick={toggleMute}
        aria-label={muted ? "Unmute" : "Mute"}
      >
        {muted ? <SpeakerMutedIcon /> : <SpeakerIcon />}
      </button>
    </div>
  );
}

function LessonsBlock({ mod, numberClassName }) {
  return (
    <>
      <p className={numberClassName}>{mod.number}</p>
      <ul className={styles.lessons}>
        {mod.lessons.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className={styles.capability}>{mod.capability}</p>
    </>
  );
}

export default function TrainingSyllabus() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [displayIndex, setDisplayIndex] = useState(0);
  const [pinnedOpaque, setPinnedOpaque] = useState(true);
  const blockRefs = useRef([]);
  const fadeTimer = useRef(null);

  useEffect(() => {
    const blocks = blockRefs.current.filter(Boolean);
    if (blocks.length === 0) return undefined;

    const ratios = {};

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = Number(entry.target.dataset.index);
          ratios[index] = entry.isIntersecting ? entry.intersectionRatio : 0;
        }

        let bestIndex = 0;
        let bestRatio = -1;
        for (let i = 0; i < MODULES.length; i += 1) {
          const ratio = ratios[i] ?? 0;
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestIndex = i;
          }
        }

        if (bestRatio >= 0.5) {
          setActiveIndex(bestIndex);
        }
      },
      { threshold: [0, 0.5, 1] },
    );

    for (const block of blocks) observer.observe(block);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (activeIndex === displayIndex) return undefined;

    setPinnedOpaque(false);
    clearTimeout(fadeTimer.current);
    fadeTimer.current = setTimeout(() => {
      setDisplayIndex(activeIndex);
      setPinnedOpaque(true);
    }, 200);

    return () => clearTimeout(fadeTimer.current);
  }, [activeIndex, displayIndex]);

  const pinned = MODULES[displayIndex];

  return (
    <section
      className={styles.section}
      aria-labelledby="training-syllabus-title"
    >
      <div className={styles.inner}>
        <header className={styles.intro}>
          <p className={styles.eyebrow}>What you learn</p>
          <h2 id="training-syllabus-title" className={styles.heading}>
            You do not learn this from theory. You learn it in the room with the
            camera running.
          </h2>
        </header>

        <div className={styles.mobileStack}>
          {MODULES.map((mod, index) => (
            <article
              key={mod.number}
              className={
                index < MODULES.length - 1
                  ? styles.mobileUnit
                  : styles.mobileUnitLast
              }
            >
              <p className={styles.mobileNumber}>{mod.number}</p>
              <h3 className={styles.mobileTitle}>{mod.title}</h3>
              <div className={styles.mobileVideoWrap}>
                <TrainingPageVideo
                  src={mod.video}
                  label={`${mod.title} preview`}
                  videoClassName={styles.video}
                  frameClassName={styles.videoFrame}
                />
              </div>
              <ul className={styles.lessons}>
                {mod.lessons.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className={styles.capability}>{mod.capability}</p>
            </article>
          ))}
        </div>

        <div className={styles.desktopLayout}>
          <aside className={styles.pinned}>
            <div className={styles.numberRow} aria-hidden="true">
              {MODULES.map((mod, index) => (
                <span
                  key={mod.number}
                  className={
                    index === activeIndex
                      ? styles.numberActive
                      : styles.numberInactive
                  }
                >
                  {mod.number}
                </span>
              ))}
            </div>
            <div
              className={
                pinnedOpaque ? styles.pinnedFade : styles.pinnedFadeOut
              }
            >
              <h3 className={styles.pinnedTitle}>{pinned.title}</h3>
              <div className={styles.pinnedVideoWrap}>
                <TrainingPageVideo
                  src={pinned.video}
                  label={`${pinned.title} preview`}
                  videoClassName={styles.videoDesktop}
                  frameClassName={styles.videoFrame}
                />
              </div>
            </div>
          </aside>

          <div className={styles.scrollColumn}>
            {MODULES.map((mod, index) => (
              <article
                key={mod.number}
                ref={(node) => {
                  blockRefs.current[index] = node;
                }}
                data-index={index}
                className={styles.scrollBlock}
                aria-label={`${mod.number} ${mod.title}`}
              >
                <LessonsBlock
                  mod={mod}
                  numberClassName={
                    index === activeIndex
                      ? styles.numberActive
                      : styles.numberInactive
                  }
                />
              </article>
            ))}
          </div>
        </div>

        <div className={styles.method}>
          <h3 className={styles.methodTitle}>Taught as Do This, Not That</h3>
          <div className={styles.frames}>
            {/* TODO: replace placeholder frames with the real paired Do This / Not That stills. */}
            <figure className={styles.frame}>
              <div className={styles.framePlaceholder} aria-hidden="true">
                <span className={styles.frameLabelNot}>Not this</span>
              </div>
              <figcaption className={styles.frameCaptionSr}>Not this</figcaption>
            </figure>
            <figure className={styles.frame}>
              <div className={styles.framePlaceholder} aria-hidden="true">
                <span className={styles.frameLabelDo}>Do this</span>
              </div>
              <figcaption className={styles.frameCaptionSr}>Do this</figcaption>
            </figure>
          </div>
          <p className={styles.methodCaption}>
            Every module is taught as a pair: what fails, and what works.
          </p>
        </div>
      </div>
    </section>
  );
}
