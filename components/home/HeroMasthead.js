"use client";

import { HOME_BAND_ANCHORS } from "@/components/home/hero-band-anchors";
import styles from "./HeroMasthead.module.css";

const MASTHEAD_ITEMS = [
  {
    category: "Films.",
    qualifier: "From the Fans.",
    target: HOME_BAND_ANCHORS.films,
  },
  {
    category: "Awards.",
    qualifier: "For the Fans.",
    target: HOME_BAND_ANCHORS.reflections,
  },
  {
    category: "Games.",
    qualifier: "For the Fun.",
    target: HOME_BAND_ANCHORS.guesser,
  },
];

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function scrollToBand(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: "start",
  });
}

function handleAnchorClick(event, target) {
  if (prefersReducedMotion()) return;
  event.preventDefault();
  scrollToBand(target);
}

export default function HeroMasthead() {
  return (
    <div className="relative z-10 mx-auto w-full max-w-3xl pt-8">
      <nav
        aria-label="Home sections"
        className="flex flex-col items-center gap-5 sm:flex-row sm:justify-center sm:gap-0"
      >
        {MASTHEAD_ITEMS.map((item) => (
          <a
            key={item.target}
            href={`#${item.target}`}
            onClick={(event) => handleAnchorClick(event, item.target)}
            className="group flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center px-4 py-2 text-center sm:px-6"
          >
            <span className="flex flex-col items-center text-[11px] sm:text-xs">
              <span
                className="font-body tracking-[0.28em] text-[#F2EDE4]"
                style={{ fontVariantCaps: "small-caps" }}
              >
                {item.category}
              </span>
              <span className="font-body mt-1.5 text-[0.6em] tracking-[0.12em] text-[#F2EDE4]/65 transition-opacity group-hover:opacity-100 group-active:opacity-100">
                {item.qualifier}
              </span>
            </span>
          </a>
        ))}
      </nav>
      <div className={styles.scrollCue} aria-hidden="true">
        <span className={styles.scrollCueLine} />
      </div>
    </div>
  );
}
