"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./TrainingSyllabus.module.css";

// TODO: replace each module.video with the real insert loops once shot:
// /training/module-interview.mp4
// /training/module-filming.mp4
// /training/module-edit.mp4
// /training/module-distribution.mp4
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
    video: "/chelsea-case-study.mp4",
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
    video: "/chelsea-case-study.mp4",
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
    video: "/chelsea-case-study.mp4",
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
    video: "/chelsea-case-study.mp4",
  },
];

function ModuleVideo({ src, label, className }) {
  return (
    <video
      className={className}
      src={src}
      muted
      loop
      autoPlay
      playsInline
      preload="metadata"
      aria-label={label}
    />
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
                <ModuleVideo
                  src={mod.video}
                  label={`${mod.title} preview`}
                  className={styles.video}
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
                <ModuleVideo
                  src={pinned.video}
                  label={`${pinned.title} preview`}
                  className={styles.videoDesktop}
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
