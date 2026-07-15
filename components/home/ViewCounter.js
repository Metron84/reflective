"use client";

import { useEffect, useRef, useState } from "react";
import { formatNumber } from "@/lib/stats/format";

function currentEstimate(combinedViews, anchorAt, viewsPerMinute) {
  const elapsedMin = (Date.now() - anchorAt) / 60000;
  return combinedViews + viewsPerMinute * elapsedMin;
}

export default function ViewCounter({
  combinedViews,
  anchorAt,
  viewsPerMinute,
}) {
  const [display, setDisplay] = useState(combinedViews);
  const targetRef = useRef(combinedViews);
  const rafRef = useRef(null);

  useEffect(() => {
    targetRef.current = combinedViews;
  }, [combinedViews]);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setDisplay(currentEstimate(combinedViews, anchorAt, viewsPerMinute));
      return;
    }

    const startVal = 0;
    const endVal = currentEstimate(combinedViews, anchorAt, viewsPerMinute);
    const duration = 2200;
    const t0 = performance.now();

    function loadAnim(now) {
      const t = Math.min(1, (now - t0) / duration);
      const eased = 1 - (1 - t) ** 3;
      setDisplay(startVal + (endVal - startVal) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(loadAnim);
    }

    rafRef.current = requestAnimationFrame(loadAnim);

    const tick = setInterval(() => {
      setDisplay(currentEstimate(combinedViews, anchorAt, viewsPerMinute));
    }, 4000);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      clearInterval(tick);
    };
  }, [combinedViews, anchorAt, viewsPerMinute]);

  return (
    <span className="font-display text-signal tabular-nums">
      {formatNumber(display)}
    </span>
  );
}
