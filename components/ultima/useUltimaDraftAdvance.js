"use client";

import { useEffect, useRef, useState } from "react";

const BOT_VISIBLE_DELAY_MS = 900;
const BOT_CHAIN_GAP_MS = 350;
const MAX_STALL_RETRIES = 2;

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(), ms);
    if (!signal) return;
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Bot / timeout advance driver. Mounted from the draft room root so Players vs
 * Board cannot unmount it.
 *
 * Before: the POST /advance effect lived in UltimaDraftRoom, beside the
 * boardOpen overlay (not inside UltimaDraftBoard). Removing the overlay did not
 * unmount it. The stall was the effect depending on seconds_remaining: each
 * tick aborted the in-flight work and skipped fetchState, so bots sat on the
 * 30s clock. The advance route itself was not the failure.
 */
export default function useUltimaDraftAdvance({
  enabled,
  isPractice,
  roomCode,
  state,
  fetchState,
}) {
  const [botPicking, setBotPicking] = useState(false);
  const [humanSeconds, setHumanSeconds] = useState(null);
  const [stall, setStall] = useState(false);
  const stateRef = useRef(state);
  const recovering = useRef(false);
  const stallTries = useRef(0);
  const fetchStateRef = useRef(fetchState);
  const intervalRef = useRef(null);
  stateRef.current = state;
  fetchStateRef.current = fetchState;

  async function postAdvance() {
    const res = await fetch(
      isPractice ? "/api/ultima/practice/advance" : "/api/ultima/draft/advance",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: isPractice ? JSON.stringify({ code: roomCode }) : "{}",
      },
    );
    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    return { ok: res.ok && data.ok !== false, data };
  }

  function warnStall(snap, reason) {
    console.warn("Ultima draft stall", {
      reason,
      competition_id: snap?.competition_id ?? null,
      current_pick: snap?.current_pick ?? null,
    });
  }

  async function recoverOnce(reason) {
    if (recovering.current) return;
    recovering.current = true;
    try {
      while (stallTries.current < MAX_STALL_RETRIES) {
        const snap = stateRef.current;
        warnStall(snap, reason);
        stallTries.current += 1;
        const result = await postAdvance();
        await fetchStateRef.current();
        const moved =
          result.ok &&
          result.data.current_pick != null &&
          result.data.current_pick !== snap?.current_pick;
        if (moved) {
          stallTries.current = 0;
          setStall(false);
          return;
        }
        if (!result.ok) {
          await sleep(BOT_CHAIN_GAP_MS);
          continue;
        }
        if (result.data.skipped) {
          await sleep(BOT_CHAIN_GAP_MS);
          continue;
        }
        stallTries.current = 0;
        setStall(false);
        return;
      }
      setStall(true);
    } finally {
      recovering.current = false;
    }
  }

  useEffect(() => {
    if (!enabled || state?.state !== "live" || !state.on_clock?.is_bot) {
      setBotPicking(false);
      return undefined;
    }

    const controller = new AbortController();
    setStall(false);
    setBotPicking(true);

    (async () => {
      try {
        await sleep(BOT_VISIBLE_DELAY_MS, controller.signal);
        while (!controller.signal.aborted) {
          const snap = stateRef.current;
          if (snap?.state !== "live" || !snap.on_clock?.is_bot) break;
          const result = await postAdvance();
          if (controller.signal.aborted) break;
          if (!result.ok) {
            warnStall(snap, "advance_http");
            stallTries.current += 1;
            if (stallTries.current >= MAX_STALL_RETRIES) {
              setStall(true);
              break;
            }
            await sleep(BOT_CHAIN_GAP_MS, controller.signal);
            continue;
          }
          stallTries.current = 0;
          await fetchStateRef.current();
          if (result.data.on_clock_is_bot === false) break;
          await sleep(BOT_CHAIN_GAP_MS, controller.signal);
        }
      } catch (err) {
        if (err?.name !== "AbortError") warnStall(stateRef.current, "advance_throw");
      } finally {
        if (!controller.signal.aborted) setBotPicking(false);
      }
    })();

    return () => {
      controller.abort();
    };
  }, [enabled, isPractice, roomCode, state?.state, state?.on_clock?.is_bot]);

  useEffect(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const human = Boolean(
      enabled && state?.state === "live" && state.on_clock && !state.on_clock.is_bot,
    );
    if (!human) {
      setHumanSeconds(null);
      return undefined;
    }

    const start = Number.isFinite(state.seconds_remaining)
      ? state.seconds_remaining
      : state.timer_seconds ?? 0;
    setHumanSeconds(start);

    if (start <= 0) {
      void recoverOnce("clock_zero");
      return undefined;
    }

    let remaining = start;
    let firedZero = false;
    intervalRef.current = window.setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        setHumanSeconds(remaining);
        return;
      }
      setHumanSeconds(0);
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (!firedZero) {
        firedZero = true;
        void recoverOnce("clock_zero");
      }
    }, 1000);

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, state?.state, state?.current_pick, state?.on_clock?.id, state?.on_clock?.is_bot]);

  async function retry() {
    setStall(false);
    stallTries.current = 0;
    await recoverOnce("manual_retry");
  }

  return { botPicking, humanSeconds, stall, retry };
}
