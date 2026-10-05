"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { executeAction, newActionKey } from "@/lib/ultima/execute-action";
import { showUltimaReceipt } from "./UltimaReceipt";

/** How long "done" shows before the button goes back to idle. */
export const DONE_MS = 2000;

/**
 * Wraps one write call and tells the UI where it stands.
 *
 * state: idle | working | slow | done | error
 * run(url, body) resolves { ok, data, message }.
 *
 * One Idempotency-Key per tap. If the answer is lost (network drop, 10s
 * timeout) the key is kept, so a retry can never write twice. A definitive
 * answer from the server (done or refused) retires the key.
 */
export function useUltimaAction() {
  const [state, setState] = useState("idle");
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState("");
  const keyRef = useRef(null);
  const flight = useRef(null);
  const alive = useRef(true);
  const doneTimer = useRef(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      clearTimeout(doneTimer.current);
    };
  }, []);

  const reset = useCallback(() => {
    clearTimeout(doneTimer.current);
    setState("idle");
    setError("");
    setReceipt("");
  }, []);

  const exec = useCallback(async (url, body, sig) => {
    clearTimeout(doneTimer.current);
    // The key belongs to this exact request. A different request gets a new key.
    if (!keyRef.current || keyRef.current.sig !== sig) keyRef.current = { key: newActionKey(), sig };
    const key = keyRef.current.key;
    setState("working");
    setError("");
    setReceipt("");

    const outcome = await executeAction({
      url,
      body,
      key,
      onSlow: () => alive.current && setState((s) => (s === "working" ? "slow" : s)),
    });

    if (outcome.unknown || outcome.stillPending) {
      const message = outcome.stillPending
        ? "Still working. Check before you retry."
        : "That did not go through. Retry.";
      if (alive.current) {
        setState("error");
        setError(message);
      }
      // unknown: the server never saw it. stillPending: it may yet land.
      return { ok: false, retryable: true, ambiguous: Boolean(outcome.stillPending), message, data: {} };
    }

    const data = outcome.data ?? {};
    keyRef.current = null;
    if (outcome.status < 400 && data.ok !== false) {
      const line = typeof data.receipt === "string" ? data.receipt : "";
      if (line) showUltimaReceipt({ text: line });
      if (alive.current) {
        setState("done");
        setReceipt(line);
        doneTimer.current = setTimeout(() => alive.current && setState("idle"), DONE_MS);
      }
      return { ok: true, data, message: line };
    }
    const message = data.message || "That did not go through.";
    if (alive.current) {
      setState("error");
      setError(message);
    }
    return { ok: false, retryable: false, ambiguous: false, message, data };
  }, []);

  const run = useCallback(
    (url, body) => {
      const sig = `${url}|${JSON.stringify(body ?? {})}`;
      const current = flight.current;
      // The same tap twice joins the first. A different request waits its turn.
      if (current && current.sig === sig) return current.promise;
      const start = () => exec(url, body, sig);
      const promise = (current ? current.promise.then(start, start) : start()).finally(() => {
        if (flight.current?.promise === promise) flight.current = null;
      });
      flight.current = { sig, promise };
      return promise;
    },
    [exec],
  );

  return {
    state,
    error,
    receipt,
    busy: state === "working" || state === "slow",
    run,
    reset,
  };
}
