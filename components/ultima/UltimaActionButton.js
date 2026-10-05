"use client";

import styles from "./ultima.module.css";
import { useUltimaAction } from "./useUltimaAction";

/**
 * One button for every write. While it works: spinner, disabled, a verb in
 * progress. Done: a tick and the past tense for 2s. Error: the server's short
 * reason and Retry.
 *
 * url, body (object or function), label, workingLabel ("Signing…"),
 * doneLabel ("Signed"), onDone(data), onError(result).
 */
export default function UltimaActionButton({
  url,
  body,
  label,
  workingLabel,
  doneLabel,
  onDone,
  onError,
  className = styles.primaryBtn,
  disabled = false,
  title,
}) {
  const { state, error, busy, run } = useUltimaAction();

  async function tap() {
    if (busy || disabled) return;
    const result = await run(url, typeof body === "function" ? body() : body);
    if (result.ok) onDone?.(result.data);
    else onError?.(result);
  }

  if (state === "error") {
    return (
      <span className={styles.actionError}>
        <span className={styles.actionErrorText} role="alert">
          {error}
        </span>
        <button type="button" className={className} onClick={tap} disabled={disabled}>
          Retry
        </button>
      </span>
    );
  }

  const text = busy ? workingLabel : state === "done" ? (doneLabel ?? label) : label;
  return (
    <button
      type="button"
      className={className}
      onClick={tap}
      disabled={disabled || busy}
      aria-busy={busy}
      title={title}
    >
      {busy ? <span className={styles.actionSpinner} aria-hidden /> : null}
      {state === "done" ? (
        <span className={styles.actionTick} aria-hidden>
          ✓
        </span>
      ) : null}
      <span>{text}</span>
      {state === "slow" ? <span className={styles.actionSlow}>Taking longer than usual</span> : null}
    </button>
  );
}
