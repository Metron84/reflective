"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./ultima.module.css";

const EVENT = "ultima:receipt";
const STORE_KEY = "ultima:receipt";
const OK_MS = 4000;
const ERROR_MS = 6500;
const HANDOFF_MAX_AGE_MS = 15_000;

/**
 * Show a receipt. Call it only after the server confirmed the write, with the
 * one line the server sent. tone "error" is for a refused optimistic move.
 * persist keeps the line across a page reload (the next page shows it).
 */
export function showReceipt({ text, tone = "ok", persist = false } = {}) {
  if (!text || typeof window === "undefined") return;
  if (persist) {
    try {
      window.sessionStorage.setItem(STORE_KEY, JSON.stringify({ text, tone, at: Date.now() }));
    } catch {
      /* storage can be blocked */
    }
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { text, tone } }));
}

/** Mounted once in the Ultima shell. Shows one receipt at a time. */
export default function UltimaReceiptHost() {
  const [receipt, setReceipt] = useState(null);
  const timer = useRef(null);

  const show = useCallback((next) => {
    clearTimeout(timer.current);
    setReceipt({ ...next, id: Date.now() });
    timer.current = setTimeout(() => setReceipt(null), next.tone === "error" ? ERROR_MS : OK_MS);
  }, []);

  useEffect(() => {
    const onReceipt = (event) => show(event.detail);
    window.addEventListener(EVENT, onReceipt);
    let handoff = null;
    try {
      const raw = window.sessionStorage.getItem(STORE_KEY);
      if (raw) {
        window.sessionStorage.removeItem(STORE_KEY);
        const held = JSON.parse(raw);
        if (held?.text && Date.now() - held.at < HANDOFF_MAX_AGE_MS) {
          handoff = setTimeout(() => show(held), 0);
        }
      }
    } catch {
      /* ignore */
    }
    return () => {
      window.removeEventListener(EVENT, onReceipt);
      clearTimeout(handoff);
      clearTimeout(timer.current);
    };
  }, [show]);

  if (!receipt) return null;
  const isError = receipt.tone === "error";
  return (
    <button
      key={receipt.id}
      type="button"
      className={isError ? styles.receiptError : styles.receipt}
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      onClick={() => setReceipt(null)}
    >
      <span className={styles.receiptMark} aria-hidden>
        {isError ? "!" : "✓"}
      </span>
      <span className={styles.receiptText}>{receipt.text}</span>
    </button>
  );
}
