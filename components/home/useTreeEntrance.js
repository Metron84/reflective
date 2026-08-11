"use client";

import { useEffect, useState } from "react";

const SESSION_KEY = "trf-tree-entered";

const SERVER_ENTRANCE = {
  skipEntrance: true,
  animate: false,
  shouldMarkPlayed: false,
};

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
    return SERVER_ENTRANCE;
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
  const [{ skipEntrance, animate }, setEntrance] = useState(SERVER_ENTRANCE);

  useEffect(() => {
    const next = resolveEntranceState();
    setEntrance(next);
    if (next.shouldMarkPlayed) {
      sessionStorage.setItem(SESSION_KEY, "1");
    }
  }, []);

  return { skipEntrance, animate };
}
