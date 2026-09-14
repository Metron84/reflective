"use client";

import { useEffect, useState } from "react";
import { INSTALL_SEEN_KEY } from "@the-crest/lib/quiz-content";
import styles from "./InstallPrompt.module.css";

/**
 * Shown once after the user completes the quiz flow (Section 4 will tie this to
 * the real result screen).
 * @param {{ show: boolean }} props
 */
export default function InstallPrompt({ show }) {
  const [deferred, setDeferred] = useState(null);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = localStorage.getItem(INSTALL_SEEN_KEY);
    if (seen) return;

    const isIos =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(/** @type {Window & { MSStream?: unknown }} */ (window)).MSStream;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      /** @type {Navigator & { standalone?: boolean }} */ (navigator).standalone;
    if (standalone) return;

    function onBeforeInstall(e) {
      e.preventDefault();
      setDeferred(e);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  useEffect(() => {
    if (!show) return;
    if (typeof window === "undefined") return;
    if (localStorage.getItem(INSTALL_SEEN_KEY)) return;

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      /** @type {Navigator & { standalone?: boolean }} */ (navigator).standalone;
    if (standalone) return;

    const isIos =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(/** @type {Window & { MSStream?: unknown }} */ (window)).MSStream;

    if (deferred || isIos) {
      setVisible(true);
      if (isIos && !deferred) setIosHint(true);
    }
  }, [show, deferred]);

  function dismiss() {
    localStorage.setItem(INSTALL_SEEN_KEY, "1");
    setVisible(false);
  }

  async function install() {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    dismiss();
  }

  if (!visible) return null;

  return (
    <div className={styles.wrap} role="dialog" aria-labelledby="install-title">
      <div className={styles.card}>
        <h2 id="install-title" className={styles.title}>
          Install The Crest
        </h2>
        <p className={styles.body}>
          {iosHint
            ? "Add to your home screen to play offline. Tap Share, then Add to Home Screen."
            : "Keep The Crest on your home screen. It works offline after the first visit."}
        </p>
        <div className={styles.actions}>
          {!iosHint && deferred ? (
            <button type="button" className={styles.primary} onClick={install}>
              Install
            </button>
          ) : null}
          <button type="button" className={styles.ghost} onClick={dismiss}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
