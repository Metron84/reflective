"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ultima.module.css";

const EVENT = "ultima:receipt";
const OK_MS = 4000;
const ERROR_MS = 6000;

/**
 * Show a receipt. Call this only after the server confirmed the write, or to
 * report a rejected optimistic move. tone: "ok" | "error".
 */
export function showUltimaReceipt({ text, tone = "ok" }) {
  if (typeof window === "undefined" || !text) return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { text, tone } }));
}

/** Mounted once in the Ultima shell. One line, one toast at a time. */
export default function UltimaReceiptHost() {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const seq = useRef(0);

  useEffect(() => {
    function onReceipt(event) {
      const { text, tone } = event.detail ?? {};
      if (!text) return;
      seq.current += 1;
      setToast({ id: seq.current, text, tone: tone === "error" ? "error" : "ok" });
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setToast(null), tone === "error" ? ERROR_MS : OK_MS);
    }
    window.addEventListener(EVENT, onReceipt);
    return () => {
      window.removeEventListener(EVENT, onReceipt);
      clearTimeout(timer.current);
    };
  }, []);

  if (!toast) return null;
  const error = toast.tone === "error";
  return (
    <div
      key={toast.id}
      className={error ? `${styles.receipt} ${styles.receiptError}` : styles.receipt}
      role={error ? "alert" : "status"}
      aria-live={error ? "assertive" : "polite"}
    >
      <span className={styles.receiptMark} aria-hidden>
        {error ? "!" : "✓"}
      </span>
      <span className={styles.receiptText}>{toast.text}</span>
      <button
        type="button"
        className={styles.receiptClose}
        aria-label="Dismiss"
        onClick={() => setToast(null)}
      >
        ×
      </button>
    </div>
  );
}
