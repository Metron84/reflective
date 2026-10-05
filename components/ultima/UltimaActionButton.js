"use client";

import { useCallback } from "react";
import { showReceipt } from "./UltimaReceipt";
import { useUltimaAction } from "./useUltimaAction";
import styles from "./ultima.module.css";

/**
 * A button for one Ultima write.
 *
 * request: { url, body, method } or a function that returns it.
 * While the write runs: spinner, disabled, workingLabel. When the server
 * confirms: tick and doneLabel for 2 seconds, then the receipt toast with the
 * server's one line. On a refusal: the server's short reason and Retry.
 * onDone(body) runs after confirmation only, so the page changes only then.
 */
export default function UltimaActionButton({
  request,
  label,
  workingLabel,
  doneLabel,
  onDone,
  onError,
  persistReceipt = false,
  variant = "secondary",
  disabled = false,
  className = "",
  type = "button",
}) {
  const action = useUltimaAction();
  const { state, error, run, busy } = action;

  const go = useCallback(async () => {
    const req = typeof request === "function" ? request() : request;
    if (!req) return;
    const result = await run(req);
    if (result.ok) {
      if (result.body?.receipt) {
        showReceipt({ text: result.body.receipt, persist: persistReceipt });
      }
      onDone?.(result.body);
    } else {
      onError?.(result);
    }
  }, [request, run, onDone, onError, persistReceipt]);

  const tone =
    variant === "primary"
      ? styles.uaPrimary
      : variant === "quiet"
        ? styles.uaQuiet
        : styles.uaSecondary;
  const shown =
    state === "working" || state === "slow"
      ? workingLabel
      : state === "done"
        ? (doneLabel ?? label)
        : label;

  return (
    <span className={styles.uaWrap}>
      <button
        type={type}
        className={`${styles.uaBtn} ${tone} ${className}`.trim()}
        disabled={busy || disabled || state === "done"}
        aria-busy={busy}
        onClick={go}
      >
        {busy ? <span className={styles.uaSpin} aria-hidden /> : null}
        {state === "done" ? (
          <span className={styles.uaTick} aria-hidden>
            {"✓"}
          </span>
        ) : null}
        <span aria-live="polite">{shown}</span>
      </button>
      {state === "slow" ? <span className={styles.uaSlow}>Still working.</span> : null}
      {state === "error" && error ? (
        <span className={styles.uaError} role="alert">
          <span>{error.message}</span>
          <button type="button" className={styles.uaRetry} onClick={go}>
            Retry
          </button>
        </span>
      ) : null}
    </span>
  );
}
