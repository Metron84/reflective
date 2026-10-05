"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DONE_FOR_MS,
  SLOW_AFTER_MS,
  newActionKey,
  performAction,
} from "@/lib/ultima/action-client";

/**
 * One hook for every Ultima write.
 *
 * state: idle | working | slow | done | error
 *   working  the request is out
 *   slow     still out after 2 seconds
 *   done     the server confirmed; returns to idle after 2 seconds
 *   error    the server refused, or could not say. error.message is a short reason.
 * After 10 seconds the hook stops waiting and asks the server whether the tap
 * landed. A retry of an unconfirmed tap reuses its key, so it cannot write twice.
 *
 * run({ url, body, method }) resolves { ok, body, code, message, uncertain }.
 */
export function useUltimaAction({ doneMs = DONE_FOR_MS } = {}) {
  const [state, setState] = useState("idle");
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const latest = useRef(0);
  const pending = useRef(null); // { sig, key } of a tap that was never confirmed
  const timers = useRef({ slow: null, done: null });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const held = timers.current;
    return () => {
      mounted.current = false;
      clearTimeout(held.slow);
      clearTimeout(held.done);
    };
  }, []);

  const run = useCallback(
    async (request) => {
      const id = latest.current + 1;
      latest.current = id;
      const live = () => mounted.current && latest.current === id;

      clearTimeout(timers.current.slow);
      clearTimeout(timers.current.done);

      const sig = JSON.stringify([request.method ?? "POST", request.url, request.body ?? null]);
      const key = pending.current?.sig === sig ? pending.current.key : newActionKey();

      setError(null);
      setState("working");
      timers.current.slow = setTimeout(() => {
        if (live()) setState((s) => (s === "working" ? "slow" : s));
      }, SLOW_AFTER_MS);

      const result = await performAction({ ...request, key });
      clearTimeout(timers.current.slow);

      pending.current = result.uncertain ? { sig, key } : null;

      if (!live()) return result;
      if (result.ok) {
        setData(result.body);
        setState("done");
        timers.current.done = setTimeout(() => {
          if (live()) setState("idle");
        }, doneMs);
      } else {
        setError({ code: result.code, message: result.message, uncertain: result.uncertain });
        setState("error");
      }
      return result;
    },
    [doneMs],
  );

  const reset = useCallback(() => {
    latest.current += 1;
    clearTimeout(timers.current.slow);
    clearTimeout(timers.current.done);
    setState("idle");
    setError(null);
  }, []);

  return { state, error, data, run, reset, busy: state === "working" || state === "slow" };
}
