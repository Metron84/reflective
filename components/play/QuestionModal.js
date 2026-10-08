"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import styles from "./play.module.css";

function speechCtor() {
  if (typeof window === "undefined") return null;
  const w = window;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export default function QuestionModal({
  question,
  result,
  busy,
  error,
  onSubmit,
  onNext,
  onContinue,
}) {
  const [text, setText] = useState("");
  const [trap, setTrap] = useState("");
  const [left, setLeft] = useState(question.answerSeconds);
  const [listening, setListening] = useState(false);
  const canSpeak = useSyncExternalStore(
    () => () => {},
    () => !!speechCtor(),
    () => false,
  );
  const textRef = useRef("");
  const trapRef = useRef("");
  const submitted = useRef(false);
  const submitRef = useRef(onSubmit);
  useEffect(() => {
    submitRef.current = onSubmit;
    textRef.current = text;
    trapRef.current = trap;
  });

  // Countdown. At zero the answer goes in as-is and the server marks it a timeout if it is late.
  useEffect(() => {
    if (result) return;
    const end = Date.now() + question.answerSeconds * 1000;
    const tick = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining === 0 && !submitted.current) {
        submitted.current = true;
        submitRef.current(textRef.current, trapRef.current);
      }
    }, 250);
    return () => clearInterval(tick);
  }, [question.questionId, question.answerSeconds, result]);

  function send() {
    if (submitted.current || busy) return;
    submitted.current = true;
    onSubmit(text, trap);
  }

  function speak() {
    const Ctor = speechCtor();
    if (!Ctor || listening) return;
    const rec = new Ctor();
    rec.lang = "en-GB";
    rec.interimResults = false;
    rec.onresult = (e) => setText(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    setListening(true);
    rec.start();
  }

  const urgent = left <= 10 && !result;

  return (
    <div className={styles.sheetBackdrop} role="dialog" aria-modal="true" aria-label="Question">
      <div className={styles.sheet}>
        <div className={styles.sheetTop}>
          <p className={styles.sheetMeta}>
            {question.category} · {question.value}
          </p>
          {!result && (
            <p className={`${styles.timer} ${urgent ? styles.timerUrgent : ""}`} aria-label={`${left} seconds left`}>
              {left}
            </p>
          )}
        </div>
        <p className={`${styles.clue} ${styles.clueIn}`}>{question.clue}</p>

        {!result ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <label htmlFor="answer" className="sr-only">
              Your answer
            </label>
            <input
              id="answer"
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              maxLength={200}
              placeholder="Type your answer"
              className={styles.field}
            />
            <input
              name="website"
              value={trap}
              onChange={(e) => setTrap(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden
              className="absolute -left-[9999px] h-0 w-0 opacity-0"
            />
            <div className={styles.row}>
              <button type="submit" disabled={busy || !text.trim()} className={`${styles.primary} ${styles.grow}`}>
                Answer
              </button>
              {canSpeak && (
                <button type="button" onClick={speak} className={styles.secondary}>
                  {listening ? "Listening" : "Tap to speak"}
                </button>
              )}
            </div>
            {error && <p className={styles.error}>{error}</p>}
          </form>
        ) : (
          <div aria-live="polite">
            <p className={styles.verdict}>
              {result.timedOut ? "Time is up" : result.correct ? "Correct" : "Not this time"}{" "}
              <span className={styles.gold}>
                {result.pointsChange > 0 ? `+${result.pointsChange}` : result.pointsChange}
              </span>
            </p>
            <p className={styles.answerLine}>
              The answer: <span className={styles.gold}>{result.answer}</span>
            </p>
            {result.next === "continuePrompt" ? (
              <div>
                <p className={styles.prompt}>Do you want to continue?</p>
                <div className={styles.row}>
                  <button onClick={() => onContinue(true)} disabled={busy} className={`${styles.primary} ${styles.grow}`}>
                    Yes
                  </button>
                  <button onClick={() => onContinue(false)} disabled={busy} className={`${styles.secondary} ${styles.grow}`}>
                    No
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={onNext} disabled={busy} className={styles.primary}>
                {result.next === "finished" ? "See your score" : "Spin again"}
              </button>
            )}
            {error && <p className={styles.error}>{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
