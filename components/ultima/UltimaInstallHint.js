"use client";

import { useEffect, useState } from "react";
import styles from "./ultima.module.css";

function isIosSafari() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return iOS && /WebKit/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

export default function UltimaInstallHint() {
  const [show, setShow] = useState(false);
  const [iosCopy, setIosCopy] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    if (isStandalone()) return;
    setIosCopy(isIosSafari());
    setShow(true);
  }, []);

  useEffect(() => {
    function onBeforeInstall(event) {
      event.preventDefault();
      setDeferredPrompt(event);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  if (!show) return null;

  async function install() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } catch {
      // ignore
    }
    setDeferredPrompt(null);
    setShow(false);
  }

  return (
    <p className={styles.installLine}>
      {iosCopy
        ? "Add Ultima to your home screen. Share, then Add to Home Screen."
        : "Add Ultima to your home screen."}{" "}
      {!iosCopy && deferredPrompt ? (
        <button type="button" className={styles.quietLink} onClick={install}>
          Install
        </button>
      ) : null}
    </p>
  );
}
