"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchWithRetry } from "@/lib/play/fetch-retry";
import { warmBrowserCheck } from "@/lib/play/warm-check";
import FansButton from "./FansButton.js";
import EndScreen from "./EndScreen.js";
import LeaderboardView from "./LeaderboardView.js";
import { stageAfter } from "@/lib/play/leaderboard.js";
import QuestionModal from "./QuestionModal.js";
import ScoreBar from "./ScoreBar.js";
import Wheel from "./Wheel.js";
import styles from "./play.module.css";

function post(path, body) {
  return fetchWithRetry(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

/** `autoSave` is true when the player returns from sign-up: the server saves the finished game held by their cookie. */
export default function PlayGame({ autoSave = false, board = null, base = "", leaderboard = [] }) {
  const [stage, setStage] = useState(autoSave ? "saving" : "landing");
  const [beat, setBeat] = useState("idle");
  const [segments, setSegments] = useState([]);
  const [max, setMax] = useState(10);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [spin, setSpin] = useState(null);
  const [target, setTarget] = useState(null);
  const [result, setResult] = useState(null);
  const [finish, setFinish] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [stuck, setStuck] = useState(false);
  const claimed = useRef(false);

  const fatal = (msg) => {
    setError(msg);
    setStuck(true);
    setBusy(false);
  };

  const start = useCallback(async () => {
    setBusy(true);
    setError(null);
    setStuck(false);
    const r = await post("/api/play/session");
    if (!r.ok) {
      setBusy(false);
      setStage("landing");
      setError(r.data.error ?? "Could not start. Try again.");
      return;
    }
    setSegments(r.data.categories);
    setMax(r.data.maxQuestions);
    setScore(0);
    setAnswered(0);
    setSpin(null);
    setTarget(null);
    setResult(null);
    setFinish(null);
    setBeat("idle");
    setStage("playing");
    setBusy(false);
  }, []);

  const claim = useCallback(async () => {
    setBusy(true);
    const r = await post("/api/play/claim");
    setBusy(false);
    if (typeof window !== "undefined") window.history.replaceState(null, "", window.location.pathname);
    if (r.ok) {
      setFinish(r.data);
      setStage("end");
      return;
    }
    if (r.data.summary) {
      setFinish({ summary: r.data.summary, signedIn: true, error: r.data.error });
      setStage("end");
      return;
    }
    setStage("landing");
    setError(`${r.data.error ?? "Could not save your score."} Play again to set a new one.`);
  }, []);

  useEffect(() => {
    warmBrowserCheck();
  }, []);

  useEffect(() => {
    if (autoSave && !claimed.current) {
      claimed.current = true;
      claim();
    }
  }, [autoSave, claim]);

  async function retrySave() {
    const r = await post("/api/play/claim");
    if (r.ok) setFinish(r.data);
    else setFinish((f) => ({ ...f, error: r.data.error ?? f.error }));
  }

  async function doSpin() {
    setBusy(true);
    setError(null);
    setResult(null);
    const r = await post("/api/play/spin");
    if (!r.ok) {
      if (r.data.next === "finished") return void endGame();
      return fatal(r.data.error ?? "Could not spin. Start a new game.");
    }
    setSpin(r.data);
    setBeat("spinning");
    setTarget(r.data.category);
  }

  function wheelDone() {
    setSegments((prev) => spin?.wheel ?? prev);
    setBeat("reveal");
    setTimeout(() => {
      setBeat("question");
      setBusy(false);
    }, 900);
  }

  async function submit(text, honeypot) {
    setBusy(true);
    setError(null);
    const r = await post("/api/play/answer", { answer: text, website: honeypot });
    if (!r.ok) return fatal(r.data.error ?? "Could not check that answer. Start a new game.");
    setResult(r.data);
    setScore(r.data.score);
    setAnswered(r.data.answered);
    setSegments(r.data.wheel);
    setBusy(false);
  }

  async function endGame() {
    setBusy(true);
    const r = await post("/api/play/finish");
    if (!r.ok) return fatal(r.data.error ?? "Could not finish. Start a new game.");
    setFinish(r.data);
    setBeat("idle");
    setSpin(null);
    setTarget(null);
    setStage("end");
    setBusy(false);
  }

  function resetBeat() {
    setSpin(null);
    setTarget(null);
    setResult(null);
    setBeat("idle");
  }

  function next() {
    if (!result) return;
    if (result.next === "finished") return void endGame();
    resetBeat();
  }

  async function onContinue(yes) {
    setBusy(true);
    const r = await post("/api/play/continue", { choice: yes ? "yes" : "no" });
    if (!r.ok) return fatal(r.data.error ?? "Could not continue. Start a new game.");
    if (r.data.next === "finished") return void endGame();
    setSegments(r.data.wheel);
    setBusy(false);
    resetBeat();
  }

  if (stage === "saving") {
    return (
      <section className="mx-auto max-w-md px-5 py-16" role="status" aria-live="polite">
        <p className="text-2xl font-black">Saving your score</p>
        <p className="mt-2 text-base">One moment.</p>
      </section>
    );
  }

  if (stage === "landing") {
    return (
      <>
        <section className="mx-auto flex max-w-md flex-col px-5 py-10">
          <p className="text-xs font-bold uppercase tracking-widest text-navy/70">The Reflective Football</p>
          <h1 className="mt-3 text-5xl font-black leading-[1.02]">Are You Really a Fan?</h1>
          <p className="mt-4 text-lg font-semibold">Spin the wheel. Answer the clue. Prove it.</p>
          <ul className="mt-5 space-y-1 text-base">
            <li>Up to 10 questions.</li>
            <li>Right answers add points. Wrong ones take them away.</li>
            <li>No sign-up needed to play. Sign up free to save your score.</li>
          </ul>
          <button
            onClick={start}
            disabled={busy}
            className="mt-8 rounded-lg bg-signal px-5 py-4 text-lg font-bold text-paper disabled:opacity-50"
          >
            {busy ? "Getting the wheel ready" : "Play now"}
          </button>
          {error && (
            <p className="mt-3 text-sm font-semibold" role="alert">
              {error}
            </p>
          )}
          <FansButton className="mt-4" />
          <p className="mt-10 text-sm font-semibold text-navy/60">Football is nothing without the fans.</p>
        </section>
        {board}
      </>
    );
  }

  if (stage === "end" && finish) {
    return (
      <EndScreen
        base={base}
        finish={finish}
        onAgain={start}
        onRetry={retrySave}
        retrying={busy}
        onLeaderboard={() => setStage((s) => stageAfter(s, "leaderboard", finish))}
      />
    );
  }

  if (stage === "leaderboard" && finish) {
    return (
      <LeaderboardView
        weeks={leaderboard}
        summary={finish.summary}
        finish={finish}
        onAgain={start}
        onBack={() => setStage((s) => stageAfter(s, "back", finish))}
      />
    );
  }

  const spinning = beat === "spinning";
  return (
    <>
      <ScoreBar score={score} answered={answered} max={max} />
      <section className="mx-auto flex max-w-md flex-col items-center px-5 pb-10 pt-8">
        <Wheel segments={segments} target={target} onDone={wheelDone} />
        <div className="mt-6 flex h-16 items-center justify-center" aria-live="polite">
          {beat === "reveal" && spin && (
            <p className={`${styles.chipFlip} rounded-lg bg-navy px-5 py-3 text-xl font-black text-paper`}>
              {spin.category} · {spin.value}
            </p>
          )}
        </div>
        <button
          onClick={doSpin}
          disabled={busy || spinning || beat !== "idle" || stuck}
          className="mt-2 w-full rounded-lg bg-signal px-5 py-4 text-lg font-bold text-paper disabled:opacity-40"
        >
          {spinning ? "Spinning" : "Spin"}
        </button>
        {error && !stuck && <p className="mt-3 text-sm font-semibold">{error}</p>}
      </section>

      {beat === "question" && spin && (
        <QuestionModal
          key={spin.questionId}
          question={spin}
          result={result}
          busy={busy}
          error={stuck ? null : error}
          onSubmit={submit}
          onNext={next}
          onContinue={onContinue}
        />
      )}

      {stuck && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/70 sm:items-center" role="alertdialog" aria-modal="true">
          <div className="w-full max-w-md rounded-t-2xl bg-paper p-5 sm:rounded-2xl">
            <p className="text-lg font-bold">{error}</p>
            <button onClick={start} className="mt-4 w-full rounded-lg bg-signal px-4 py-3 text-base font-bold text-paper">
              Start a new game
            </button>
            <FansButton className="mt-3" />
          </div>
        </div>
      )}
    </>
  );
}
