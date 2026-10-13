"use client";

import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { REACH } from "@/lib/home";
import { SOCIALS } from "@/lib/nav";
import { InstagramIcon, YouTubeIcon } from "@/components/nav/SocialIcons";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal";

const instagram = SOCIALS.find((s) => s.key === "instagram");
const youtube = SOCIALS.find((s) => s.key === "youtube");

function CountUp() {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const [display, setDisplay] = useState(REACH.value);

  useEffect(() => {
    if (reduce) return undefined;
    // Park at zero after hydration; no-JS and reduced motion keep REACH.value.
    const frame = requestAnimationFrame(() =>
      setDisplay(`0${REACH.value.replace(/^\d+/, "")}`),
    );
    return () => cancelAnimationFrame(frame);
  }, [reduce]);

  useEffect(() => {
    if (reduce || !inView) return undefined;
    const suffix = REACH.value.replace(/^\d+/, "");
    const controls = animate(0, REACH.count, {
      duration: 1.8,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(`${Math.round(v)}${suffix}`),
      onComplete: () => setDisplay(REACH.value),
    });
    return () => controls.stop();
  }, [inView, reduce]);

  return (
    <p ref={ref} className="text-center">
      <span
        aria-hidden
        className="block font-display text-6xl leading-none tabular-nums text-paper sm:text-7xl lg:text-8xl"
      >
        {display}
      </span>
      <span className="sr-only">{REACH.value}</span>
      <span className="mt-3 block text-xs font-semibold uppercase tracking-[0.22em] text-paper/80">
        {REACH.label}
      </span>
    </p>
  );
}

function ReachLink({ social, Icon, handle, action, align }) {
  return (
    <a
      href={social.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${social.label}, ${action}. Opens in a new tab.`}
      className={`group flex items-center justify-center gap-3 rounded-full border border-paper/40 px-4 py-3 text-paper transition-colors hover:border-paper hover:bg-paper/10 lg:flex-col lg:gap-2 lg:rounded-none lg:border-0 lg:px-0 lg:py-0 lg:hover:bg-transparent ${
        align === "left" ? "lg:items-start lg:text-left" : "lg:items-end lg:text-right"
      } ${focusRing}`}
    >
      <Icon className="h-5 w-5 shrink-0 lg:h-8 lg:w-8" />
      <span className="text-sm font-semibold lg:hidden">{action}</span>
      <span className="hidden lg:block">
        <span className="block text-base font-semibold">{handle}</span>
        <span className="mt-1 block text-sm text-paper/75 transition-colors group-hover:text-paper">
          {action}
        </span>
      </span>
    </a>
  );
}

export default function ReachBand() {
  return (
    <section
      aria-label="Our reach"
      className="border-y border-signal bg-navy"
    >
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-3 gap-y-8 px-4 py-10 sm:px-6 lg:grid-cols-3 lg:items-center lg:gap-8 lg:py-14">
        <div className="col-span-2 lg:order-2 lg:col-span-1">
          <CountUp />
        </div>
        <div className="lg:order-1">
          <ReachLink
            social={instagram}
            Icon={InstagramIcon}
            handle="@thereflectivefootball"
            action="Follow the reels"
            align="left"
          />
        </div>
        <div className="lg:order-3">
          <ReachLink
            social={youtube}
            Icon={YouTubeIcon}
            handle="The Reflective Football"
            action="Watch the episodes"
            align="right"
          />
        </div>
      </div>
    </section>
  );
}
