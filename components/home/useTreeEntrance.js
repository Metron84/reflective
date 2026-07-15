"use client";

import { useEffect, useState } from "react";

const SESSION_KEY = "trf-tree-entered";

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isBackNavigation() {
  if (typeof window === "undefined") return false;
  const nav = performance.getEntriesByType("navigation")[0];
  return nav?.type === "back_forward";
}

function resolveEntranceState() {
  if (typeof window === "undefined") {
    return { skipEntrance: true, animate: false, shouldMarkPlayed: false };
  }

  const reduced = prefersReducedMotion();
  const back = isBackNavigation();
  const played = sessionStorage.getItem(SESSION_KEY) === "1";

  if (reduced || back || played) {
    return { skipEntrance: true, animate: false, shouldMarkPlayed: false };
  }

  return { skipEntrance: false, animate: true, shouldMarkPlayed: true };
}

export function useTreeEntrance() {
  const [{ skipEntrance, animate, shouldMarkPlayed }] = useState(resolveEntranceState);

  useEffect(() => {
    if (shouldMarkPlayed) {
      sessionStorage.setItem(SESSION_KEY, "1");
    }
  }, [shouldMarkPlayed]);

  return { skipEntrance, animate };
}
