"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const VISIT_KEY = "trf_visit_count";
const DISMISS_KEY = "trf_pwa_hint_dismissed_at";
const DISMISS_MS = 30 * 24 * 60 * 60 * 1000;

function isIosSafari() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const webkit = /WebKit/.test(ua);
  const notChrome = !/CriOS|FxiOS|EdgiOS/.test(ua);
  return iOS && webkit && notChrome;
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function shouldHidePath(pathname) {
  if (!pathname) return true;
  if (pathname === "/concierge" || pathname.startsWith("/concierge/")) return true;
  if (pathname === "/reflections" || pathname.startsWith("/reflections/")) return true;
  return false;
}

export default function InstallHint() {
  const pathname = usePathname();
  const [eligible, setEligible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [iosCopy, setIosCopy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;

    try {
      const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || "0");
      if (dismissedAt && Date.now() - dismissedAt < DISMISS_MS) return;

      const visits = Number(localStorage.getItem(VISIT_KEY) || "0") + 1;
      localStorage.setItem(VISIT_KEY, String(visits));
      if (visits < 2) return;

      setIosCopy(isIosSafari());
      setEligible(true);
    } catch {
      // private mode / blocked storage
    }
  }, []);

  useEffect(() => {
    function onBeforeInstall(event) {
      event.preventDefault();
      setDeferredPrompt(event);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  if (!eligible || shouldHidePath(pathname)) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    setEligible(false);
  }

  async function install() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } catch {
      // ignore
    }
    setDeferredPrompt(null);
    dismiss();
  }

  return (
    <div
      className="fixed inset-x-0 z-50 px-4"
      style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
      role="dialog"
      aria-label="Install The Reflective Football"
    >
      <div className="mx-auto flex max-w-lg items-start gap-3 border border-navy/15 bg-paper px-4 py-3 shadow-[0_8px_24px_rgba(10,17,31,0.12)]">
        <div className="min-w-0 flex-1">
          <p className="font-display text-base text-navy">Add TRF to your home screen</p>
          <p className="mt-1 text-sm text-navy/70">
            {iosCopy
              ? "Tap Share, then Add to Home Screen."
              : "Install for a faster way back to films, votes, and The Guesser."}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {!iosCopy && deferredPrompt ? (
              <button
                type="button"
                onClick={install}
                className="border border-navy bg-navy px-3 py-1.5 text-sm font-medium text-paper transition-colors hover:bg-navy/90 active:scale-[0.98]"
              >
                Install
              </button>
            ) : null}
            <button
              type="button"
              onClick={dismiss}
              className="text-sm text-navy/60 underline-offset-2 transition-colors hover:text-navy hover:underline"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 p-1 text-navy/40 transition-colors hover:text-navy"
        >
          ×
        </button>
      </div>
    </div>
  );
}
