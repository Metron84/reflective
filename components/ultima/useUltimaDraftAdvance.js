"use client";

import { useEffect, useRef, useState } from "react";

const BOT_VISIBLE_DELAY_MS = 900;
const BOT_CHAIN_GAP_MS = 350;
const MAX_STALL_RETRIES = 2;
const STALE_LOCK_MS = 5000;

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Bot / timeout advance driver. Mounted from the draft room root so Players vs
 * Board cannot unmount it.
 *
 * Part A finding: chooseBotPick threw ReferenceError (ULTIMA_LEAGUES missing),
 * so POST /advance returned 500. Both fresh and resumed rooms stalled on any
 * bot seat. The retry button did reach advance; the route failed every time.
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
  const [stallDetail, setStallDetail] = useState("");
  const [loopKey, setLoopKey] = useState(0);
  const stateRef = useRef(state);
  const advancing = useRef(false);
  const advancingSince = useRef(0);
  const lastPickSeen = useRef(state?.current_pick ?? null);
  const stallTries = useRef(0);
  const fetchStateRef = useRef(fetchState);
  const intervalRef = useRef(null);
  const isPracticeRef = useRef(isPractice);
  const roomCodeRef = useRef(roomCode);
  stateRef.current = state;
  fetchStateRef.current = fetchState;
  isPracticeRef.current = isPractice;
  roomCodeRef.current = roomCode;

  function logAdvance(phase, extra = {}) {
    const snap = stateRef.current;
    console.info("[ultima-advance]", phase, {
      competition_id: snap?.competition_id ?? extra.competition_id ?? null,
      current_pick: snap?.current_pick ?? extra.current_pick ?? null,
      "advancing.current": advancing.current,
      ...extra,
    });
  }

  function clearStaleLock(force = false) {
    if (!advancing.current) return false;
    const age = Date.now() - advancingSince.current;
    if (force || age >= STALE_LOCK_MS) {
      logAdvance("stale_lock_clear", { age_ms: age, forced: force });
      advancing.current = false;
      advancingSince.current = 0;
      return true;
    }
    return false;
  }

  async function postAdvance(reason) {
    const snap = stateRef.current;
    logAdvance("entry", { reason });
    try {
      const practice = isPracticeRef.current;
      const res = await fetch(
        practice ? "/api/ultima/practice/advance" : "/api/ultima/draft/advance",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: practice ? JSON.stringify({ code: roomCodeRef.current }) : "{}",
        },
      );
      let data = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }
      logAdvance("fetch_resolve", {
        reason,
        status: res.status,
        ok: res.ok && data.ok !== false,
        body_ok: data.ok,
        message: data.message ?? null,
        current_pick: data.current_pick ?? snap?.current_pick ?? null,
        competition_id: data.competition_id ?? snap?.competition_id ?? null,
      });
      return {
        ok: res.ok && data.ok !== false,
        status: res.status,
        data,
        message: data.message ?? (res.ok ? "" : `HTTP ${res.status}`),
      };
    } catch (err) {
      logAdvance("catch", {
        reason,
        message: err?.message ?? String(err),
      });
      return { ok: false, status: 0, data: {}, message: err?.message ?? "Network error" };
    } finally {
      logAdvance("finally", { reason });
    }
  }

  function warnStall(snap, reason, detail = "") {
    console.warn("Ultima draft stall", {
      reason,
      detail,
      competition_id: snap?.competition_id ?? null,
      current_pick: snap?.current_pick ?? null,
    });
  }

  function markStall(detail) {
    const text = detail || "";
    if (text) {
      console.error("Ultima draft stall reason", text);
    }
    setStallDetail(text);
    setStall(true);
    setBotPicking(false);
  }

  async function recoverOnce(reason, { force = false } = {}) {
    clearStaleLock(force);
    if (advancing.current) {
      logAdvance("recover_early_return", { reason });
      return;
    }
    advancing.current = true;
    advancingSince.current = Date.now();
    try {
      while (stallTries.current < MAX_STALL_RETRIES) {
        const snap = stateRef.current;
        warnStall(snap, reason);
        stallTries.current += 1;
        const result = await postAdvance(reason);
        await fetchStateRef.current();
        const moved =
          result.ok &&
          result.data.current_pick != null &&
          result.data.current_pick !== snap?.current_pick;
        if (moved) {
          stallTries.current = 0;
          setStall(false);
          setStallDetail("");
          return;
        }
        if (!result.ok || result.data.skipped) {
          if (stallTries.current >= MAX_STALL_RETRIES) {
            markStall(
              result.message
                ? `${result.status || "ERR"} · ${result.message}`
                : "",
            );
            return;
          }
          await sleep(BOT_CHAIN_GAP_MS);
          continue;
        }
        stallTries.current = 0;
        setStall(false);
        setStallDetail("");
        return;
      }
      markStall("");
    } finally {
      advancing.current = false;
      advancingSince.current = 0;
      logAdvance("recover_finally", { reason });
    }
  }

  useEffect(() => {
    if (state?.current_pick == null) return;
    if (lastPickSeen.current !== state.current_pick) {
      lastPickSeen.current = state.current_pick;
      stallTries.current = 0;
      setStall(false);
      setStallDetail("");
    }
  }, [state?.current_pick]);

  useEffect(() => {
    if (!enabled || state?.state !== "live" || !state.on_clock?.is_bot || stall) {
      if (!state?.on_clock?.is_bot || stall) setBotPicking(false);
      return undefined;
    }

    let stopped = false;
    setBotPicking(true);

    (async () => {
      clearStaleLock(true);
      advancing.current = true;
      advancingSince.current = Date.now();
      try {
        await sleep(BOT_VISIBLE_DELAY_MS);
        while (!stopped) {
          const snap = stateRef.current;
          if (snap?.state !== "live" || !snap.on_clock?.is_bot) break;
          const beforePick = snap.current_pick;
          const result = await postAdvance("bot_loop");
          await fetchStateRef.current();
          const afterPick = stateRef.current?.current_pick;
          if (result.ok && afterPick != null && afterPick !== beforePick) {
            stallTries.current = 0;
            if (result.data.on_clock_is_bot === false) break;
            await sleep(BOT_CHAIN_GAP_MS);
            continue;
          }
          warnStall(snap, "advance_http", result.message);
          stallTries.current += 1;
          if (stallTries.current >= MAX_STALL_RETRIES) {
            markStall(
              result.message
                ? `${result.status || "ERR"} · ${result.message}`
                : "",
            );
            break;
          }
          await sleep(BOT_CHAIN_GAP_MS);
        }
      } finally {
        advancing.current = false;
        advancingSince.current = 0;
        setBotPicking(false);
        logAdvance("bot_loop_finally");
      }
    })();

    return () => {
      stopped = true;
    };
  }, [enabled, state?.state, state?.on_clock?.is_bot, loopKey, stall]);

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
    logAdvance("retry_tap");
    stallTries.current = 0;
    clearStaleLock(true);
    setStall(false);
    setStallDetail("");
    if (stateRef.current?.on_clock?.is_bot) {
      setLoopKey((key) => key + 1);
      return;
    }
    await recoverOnce("manual_retry", { force: true });
  }

  return { botPicking, humanSeconds, stall, stallDetail, retry };
}
