"use client";

import { useEffect, useRef } from "react";

const LINES = [
  "Life is made of moments, and we share them with people.",
  "Those people form communities that are present, vocal, loving and respectful.",
  "In football, that bond lasts a lifetime and passes from one generation to the next.",
  "Somewhere along the way, we stopped seeing the people.",
  "I move my small pieces to show what's still there.",
];

const CARE = "People care.";
const WILL = "They always will.";
const CLOSER_START = 0.85;

function splitWords(text) {
  return text.split(/\s+/).filter(Boolean);
}

const STATEMENT = (() => {
  let index = 0;
  return LINES.map((line) => {
    const words = splitWords(line);
    const start = index;
    index += words.length;
    return { words, start };
  });
})();

const CARE_WORDS = splitWords(CARE);
const WILL_WORDS = splitWords(WILL);
const STATEMENT_COUNT = STATEMENT.reduce((n, line) => n + line.words.length, 0);
const CARE_COUNT = CARE_WORDS.length;
const WILL_COUNT = WILL_WORDS.length;
const CARE_END =
  CLOSER_START + (1 - CLOSER_START) * (CARE_COUNT / (CARE_COUNT + WILL_COUNT));

const LABEL = {
  fontFamily: "var(--font-archivo), Archivo, sans-serif",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.2em",
};

const STATEMENT_TYPE = {
  fontFamily: "var(--font-archivo), Archivo, sans-serif",
  fontStretch: "75%",
  fontWeight: 800,
  lineHeight: 0.95,
  fontSize: "clamp(1.6rem, 7vw, 2.4rem)",
  textTransform: "uppercase",
};

const CLOSER_TYPE = {
  ...STATEMENT_TYPE,
  fontSize: "clamp(2.4rem, 11vw, 3.6rem)",
};

function wordWindow(index) {
  if (index < STATEMENT_COUNT) {
    const slice = CLOSER_START / STATEMENT_COUNT;
    const start = index * slice;
    return [start, start + slice];
  }
  if (index < STATEMENT_COUNT + CARE_COUNT) {
    const i = index - STATEMENT_COUNT;
    const slice = (CARE_END - CLOSER_START) / CARE_COUNT;
    const start = CLOSER_START + i * slice;
    return [start, start + slice];
  }
  const i = index - STATEMENT_COUNT - CARE_COUNT;
  const slice = (1 - CARE_END) / WILL_COUNT;
  const start = CARE_END + i * slice;
  return [start, start + slice];
}

function wordOpacity(progress, index) {
  const [start, end] = wordWindow(index);
  const span = end - start;
  const t = span <= 0 ? 1 : Math.min(1, Math.max(0, (progress - start) / span));
  return 0.12 + 0.88 * t;
}

function Words({ words, startIndex, refFor }) {
  return words.map((word, i) => (
    <span key={startIndex + i} ref={refFor(startIndex + i)} className="founder-word">
      {word}
      {i < words.length - 1 ? " " : null}
    </span>
  ));
}

export default function FounderNote() {
  const trackRef = useRef(null);
  const stickyRef = useRef(null);
  const willRef = useRef(null);
  const bylineRef = useRef(null);
  const wordRefs = useRef([]);
  const refCallbacks = useRef([]);

  function refFor(index) {
    if (!refCallbacks.current[index]) {
      refCallbacks.current[index] = (node) => {
        wordRefs.current[index] = node;
      };
    }
    return refCallbacks.current[index];
  }

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let alive = true;

    function assignWords(opacity) {
      wordRefs.current.forEach((el) => {
        if (el) el.style.opacity = opacity;
      });
    }

    function paint() {
      if (!alive) return;
      const reduced = media.matches;
      if (reduced) {
        assignWords("1");
        if (willRef.current) {
          willRef.current.style.transform = "scale(1)";
          willRef.current.style.color = "var(--color-signal)";
        }
        if (bylineRef.current) bylineRef.current.style.opacity = "1";
        return;
      }

      const track = trackRef.current;
      const sticky = stickyRef.current;
      if (!track || !sticky) return;

      const trackRect = track.getBoundingClientRect();
      const stickyRect = sticky.getBoundingClientRect();
      const range = trackRect.height - stickyRect.height;
      const progress =
        range <= 0 ? 1 : Math.min(1, Math.max(0, -trackRect.top / range));

      wordRefs.current.forEach((el, index) => {
        if (!el) return;
        el.style.opacity = wordOpacity(progress, index).toFixed(3);
      });

      const willSpan = 1 - CARE_END;
      const willT =
        willSpan <= 0 ? 1 : Math.min(1, Math.max(0, (progress - CARE_END) / willSpan));
      if (willRef.current) {
        const scale = 0.96 + 0.04 * willT;
        willRef.current.style.transform = `scale(${scale})`;
        willRef.current.style.color = `color-mix(in srgb, var(--color-signal) ${Math.round(willT * 100)}%, var(--color-paper))`;
      }
      if (bylineRef.current) {
        bylineRef.current.style.opacity = progress >= 1 ? "1" : "0";
      }
    }

    function onScroll() {
      if (!alive || frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        paint();
      });
    }

    paint();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    media.addEventListener("change", onScroll);

    return () => {
      alive = false;
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      media.removeEventListener("change", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section
      ref={trackRef}
      aria-labelledby="why-we-do-this"
      className="founder-note-track relative h-[320svh] bg-paper lg:h-[260vh]"
    >
      <style>{`
        .founder-word { opacity: 0.12; }
        .founder-will {
          transform: scale(0.96);
          transform-origin: left center;
          color: var(--color-paper);
        }
        .founder-byline { opacity: 0; transition: opacity 0.45s ease; }
        @media (prefers-reduced-motion: reduce) {
          .founder-note-track { height: auto !important; }
          .founder-note-sticky { position: static !important; height: auto !important; }
          .founder-word { opacity: 1 !important; }
          .founder-will {
            transform: none !important;
            color: var(--color-signal) !important;
          }
          .founder-byline { opacity: 1 !important; transition: none !important; }
        }
      `}</style>
      <h2 id="why-we-do-this" className="sr-only">
        Why we do this
      </h2>
      <div
        ref={stickyRef}
        className="founder-note-sticky sticky top-0 flex h-[100svh] items-center justify-center px-4"
      >
        <div className="relative mx-auto w-full max-w-md bg-navy px-6 py-7 text-paper">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-2 border-2 border-signal"
          />
          <div className="flex items-baseline justify-between text-paper/70" style={LABEL}>
            <span>WHY WE DO THIS</span>
            <span>TRF</span>
          </div>

          <div className="mt-5 flex flex-col gap-3">
            {STATEMENT.map((line) => (
              <p key={line.start} style={STATEMENT_TYPE}>
                <Words words={line.words} startIndex={line.start} refFor={refFor} />
              </p>
            ))}
          </div>

          <div className="mt-6">
            <p className="text-paper" style={CLOSER_TYPE}>
              <Words words={CARE_WORDS} startIndex={STATEMENT_COUNT} refFor={refFor} />
            </p>
            <p
              ref={willRef}
              className="founder-will"
              style={{ ...CLOSER_TYPE, marginTop: "0.15em" }}
            >
              <Words
                words={WILL_WORDS}
                startIndex={STATEMENT_COUNT + CARE_COUNT}
                refFor={refFor}
              />
            </p>
          </div>

          <div
            ref={bylineRef}
            className="founder-byline mt-6 flex flex-col items-start gap-3 border-t border-paper/20 pt-5"
          >
            <div>
              <p className="text-[16px] font-bold leading-tight">Melo Doumani</p>
              <p className="mt-1 text-[13px] leading-snug text-paper/75">
                Founder, The Reflective Football
              </p>
            </div>
            <a
              href="https://melodoumani.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center rounded-full border-2 border-signal px-4 text-[12px] font-bold uppercase tracking-[0.12em] text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
            >
              melodoumani.com ↗
              <span className="sr-only"> Opens in a new tab.</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
