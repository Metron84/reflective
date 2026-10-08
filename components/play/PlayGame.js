"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { connectionDebugLine, fetchWithRetry } from "@/lib/play/fetch-retry";
import { warmBrowserCheck } from "@/lib/play/warm-check";
import FansButton from "./FansButton.js";
import Feedback from "./Feedback.js";
import Hero from "./Hero.js";
import EndScreen from "./EndScreen.js";
import LeaderboardView from "./LeaderboardView.js";
import MuteToggle from "./MuteToggle.js";
import { nextStreak } from "@/lib/play/feedback.js";
import { armSound, playSound } from "@/lib/play/sound.js";
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

function Mute() {
  return (
    <div className={styles.muteDock}>
      <MuteToggle />
    </div>
  );
}

/** `autoSave` is true when the player returns from sign-up: the server saves the finished game held by their cookie. */
export default function PlayGame({ autoSave = false, board = null, base = "", leaderboard = [] }) {
  const [stage, setStage] = useState(autoSave ? "saving" : "landing");
  const [beat, setBeat] = useState("idle");
  const [segments, setSegments] = useState([]);
  const [max, setMax] = useState(10);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [streak, setStreak] = useState(0);
  const [spin, setSpin] = useState(null);
  const [target, setTarget] = useState(null);
  const [result, setResult] = useState(null);
  const [finish, setFinish] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [debugLine, setDebugLine] = useState("");
  const [stuck, setStuck] = useState(false);
  const claimed = useRef(false);

  const fatal = (msg, debug) => {
    setError(msg);
    setDebugLine(connectionDebugLine(debug));
    setStuck(true);
    setBusy(false);
  };

  const start = useCallback(async () => {
    setBusy(true);
    setError(null);
    setDebugLine("");
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
    setStreak(0);
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

  useEffect(() => armSound(), []);

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
      return fatal(r.data.error ?? "Could not spin. Start a new game.", r.debug);
    }
    setSpin(r.data);
    setBeat("spinning");
    setTarget(r.data.category);
  }

  function wheelDone() {
    setSegments((prev) => spin?.wheel ?? prev);
    setBeat("reveal");
    // One second on the lit segment, then the team name, then the clue.
    setTimeout(() => setBeat("team"), 1000);
    setTimeout(() => {
      setBeat("question");
      setBusy(false);
    }, 1400);
  }

  async function submit(text, honeypot) {
    setBusy(true);
    setError(null);
    const r = await post("/api/play/answer", { answer: text, website: honeypot });
    if (!r.ok) return fatal(r.data.error ?? "Could not check that answer. Start a new game.", r.debug);
    setResult(r.data);
    playSound(r.data.correct ? "correct" : "wrong");
    setStreak((n) => nextStreak(n, !!r.data.correct));
    setScore(r.data.score);
    setAnswered(r.data.answered);
    setSegments(r.data.wheel);
    setBusy(false);
  }

  async function endGame() {
    setBusy(true);
    const r = await post("/api/play/finish");
    if (!r.ok) return fatal(r.data.error ?? "Could not finish. Start a new game.", r.debug);
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
    if (!r.ok) return fatal(r.data.error ?? "Could not continue. Start a new game.", r.debug);
    if (r.data.next === "finished") return void endGame();
    setSegments(r.data.wheel);
    setBusy(false);
    resetBeat();
  }

  if (stage === "saving") {
    return (
      <section className={styles.saving} role="status" aria-live="polite">
        <Mute />
        <h1 className={styles.headline}>Saving your score</h1>
        <p className={styles.lede}>One moment.</p>
      </section>
    );
  }

  if (stage === "landing") {
    return (
      <>
        <section className={styles.stack}>
          <Mute />
          <Hero />
          <p className={styles.lede}>Spin the wheel. Answer the clue. Prove it.</p>
          <ul className={styles.copy}>
            <li>Up to 10 questions.</li>
            <li>Right answers add points. Wrong ones take them away.</li>
            <li>No sign-up needed to play. Sign up free to save your score.</li>
          </ul>
          <button onClick={start} disabled={busy} className={`${styles.primary} ${styles.pulse}`}>
            {busy ? "Getting the wheel ready" : "Play now"}
          </button>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <FansButton className={styles.fansSlot} />
          <p className={styles.tagline}>Football is nothing without the fans.</p>
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
  const showQuestion = beat === "question" && spin;
  return (
    <>
      <section className={styles.arena}>
        <Mute />
        <h1 className={styles.headline}>Are You Really a Fan?</h1>
        <ScoreBar score={score} answered={answered} max={max} streak={streak} />
        <div className={styles.stage}>
          <Wheel
            segments={segments}
            target={target}
            spinId={spin?.questionId ?? null}
            onDone={wheelDone}
          />
          <div className={styles.reveal} aria-live="polite">
            {(beat === "team" || beat === "question") && spin && (
              <p className={styles.teamReveal}>{spin.category}</p>
            )}
          </div>
          <button
            onClick={doSpin}
            disabled={busy || spinning || beat !== "idle" || stuck}
            className={`${styles.primary} ${styles.pulse} ${styles.spin}`}
          >
            {spinning ? "Spinning" : "Spin"}
          </button>
          {error && !stuck && <p className={styles.error}>{error}</p>}
        </div>
        <div className={styles.dock}>
          {showQuestion ? (
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
          ) : (
            <p className={styles.dockEmpty}>Spin to draw a question.</p>
          )}
        </div>
      </section>

      {result && <Feedback key={answered} result={result} />}

      {stuck && (
        <div className={styles.alert} role="alertdialog" aria-modal="true">
          <div className={styles.alertCard}>
            <p className={styles.lede}>{error}</p>
            {debugLine ? <p className={styles.debugRef}>{debugLine}</p> : null}
            <button onClick={start} className={styles.primary}>
              Start a new game
            </button>
            <FansButton className={styles.fansSlot} />
          </div>
        </div>
      )}
    </>
  );
}
