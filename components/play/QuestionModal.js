"use client";

import { createPortal } from "react-dom";
import fb from "./feedback.module.css";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import styles from "./play.module.css";

function speechCtor() {
  if (typeof window === "undefined") return null;
  const w = window;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
].join(",");

function focusable(root) {
  return [...root.querySelectorAll(FOCUSABLE)].filter((el) => {
    if (el.getAttribute("aria-hidden") === "true") return false;
    if (el.tabIndex < 0) return false;
    return el.getClientRects().length > 0;
  });
}

function focusPreferred(root, showResult) {
  const preferred = showResult
    ? root.querySelector("[data-play-next]:not([disabled])")
    : root.querySelector("#answer:not([disabled])");
  if (preferred) {
    preferred.focus();
    return;
  }
  const items = focusable(root);
  if (items[0]) {
    items[0].focus();
    return;
  }
  if (!root.hasAttribute("tabindex")) root.tabIndex = -1;
  root.focus();
}

/** Freeze the page behind the question. Returns a restore function. */
function lockPage(overlay) {
  const html = document.documentElement;
  const body = document.body;
  const scrollY = window.scrollY;
  const prev = {
    htmlOverflow: html.style.overflow,
    bodyOverflow: body.style.overflow,
    bodyPosition: body.style.position,
    bodyTop: body.style.top,
    bodyLeft: body.style.left,
    bodyRight: body.style.right,
    bodyWidth: body.style.width,
  };
  html.style.overflow = "hidden";
  body.style.overflow = "hidden";
  body.style.position = "fixed";
  body.style.top = `-${scrollY}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";

  const locked = [...body.children].filter((node) => node !== overlay && !node.hasAttribute("inert"));
  locked.forEach((node) => {
    node.setAttribute("data-play-inert", "");
    node.setAttribute("inert", "");
  });

  return () => {
    html.style.overflow = prev.htmlOverflow;
    body.style.overflow = prev.bodyOverflow;
    body.style.position = prev.bodyPosition;
    body.style.top = prev.bodyTop;
    body.style.left = prev.bodyLeft;
    body.style.right = prev.bodyRight;
    body.style.width = prev.bodyWidth;
    window.scrollTo(0, scrollY);
    locked.forEach((node) => {
      if (!node.hasAttribute("data-play-inert")) return;
      node.removeAttribute("inert");
      node.removeAttribute("data-play-inert");
    });
  };
}

export default function QuestionModal({
  question,
  result,
  busy,
  error,
  onSubmit,
  skipsLeft,
  onSkip,
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
  const overlayRef = useRef(null);
  const dialogRef = useRef(null);
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

  useEffect(() => {
    const overlay = overlayRef.current;
    const dialog = dialogRef.current;
    if (!overlay || !dialog) return undefined;
    const unlock = lockPage(overlay);

    function onKey(event) {
      // A question stays up until it is answered, skipped, or the timer ends.
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      const recovery = document.querySelector("[role='alertdialog']");
      if (recovery?.contains(document.activeElement)) return;
      if (event.key !== "Tab") return;
      const items = focusable(dialog);
      if (!items.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const inside = dialog.contains(active);
      if (event.shiftKey && (!inside || active === first)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (!inside || active === last)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      unlock();
      const spin = document.getElementById("play-spin");
      if (spin instanceof HTMLButtonElement && !spin.disabled) spin.focus();
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    focusPreferred(dialog, !!result);
  }, [result]);

  function send() {
    if (submitted.current || busy) return;
    submitted.current = true;
    onSubmit(text, trap);
  }

  async function skip() {
    if (submitted.current || busy || skipsLeft < 1) return;
    submitted.current = true;
    const handled = await onSkip();
    if (!handled) submitted.current = false;
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

  function holdFocus(event) {
    if (event.target !== event.currentTarget || event.pointerType === "touch") return;
    event.preventDefault();
  }

  const urgent = left <= 10 && !result;

  if (typeof document === "undefined") return null;

  return createPortal(
    <div ref={overlayRef} className={styles.overlay} onPointerDown={holdFocus}>
      <div
        ref={dialogRef}
        className={styles.overlayPanel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="play-clue"
        tabIndex={-1}
      >
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
        <p id="play-clue" className={`${styles.clue} ${styles.clueIn}`}>
          {question.clue}
        </p>

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
            <div className={styles.answerGrid}>
              <input
                id="answer"
                value={text}
                onChange={(e) => setText(e.target.value)}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                maxLength={200}
                placeholder="Type your answer"
                className={styles.field}
              />
              <button type="submit" disabled={busy || !text.trim()} className={styles.primary}>
                Lock In
              </button>
              {canSpeak && (
                <button type="button" onClick={speak} className={styles.secondary}>
                  {listening ? "Listening" : "Tap to speak"}
                </button>
              )}
              <button
                type="button"
                onClick={skip}
                disabled={busy || skipsLeft < 1}
                className={`${styles.secondary} ${styles.skip}`}
              >
                {skipsLeft < 1 ? "No skips left" : `Skip (${skipsLeft} left)`}
              </button>
            </div>
            <input
              name="website"
              value={trap}
              onChange={(e) => setTrap(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden
              className="absolute -left-[9999px] h-0 w-0 opacity-0"
            />
            {error && <p className={styles.error}>{error}</p>}
          </form>
        ) : (
          <div aria-live="polite">
            <p className={styles.verdict}>
              {result.skipped ? "Skipped" : result.timedOut ? "Time is up" : result.correct ? "Correct" : "Not this time"}{" "}
              <span className={styles.gold}>
                {result.pointsChange > 0 ? `+${result.pointsChange}` : result.pointsChange}
              </span>
            </p>
            <p className={`${styles.answerLine} ${result.correct ? "" : fb.answerReveal}`}>
              The answer: <span className={styles.gold}>{result.answer}</span>
            </p>
            {result.next === "continuePrompt" ? (
              <div>
                <p className={styles.prompt}>Do you want to continue?</p>
                <div className={styles.answerGrid}>
                  <button
                    type="button"
                    data-play-next
                    onClick={() => onContinue(true)}
                    disabled={busy}
                    className={styles.primary}
                  >
                    Yes
                  </button>
                  <button type="button" onClick={() => onContinue(false)} disabled={busy} className={styles.secondary}>
                    No
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.answerGrid}>
                <button type="button" data-play-next onClick={onNext} disabled={busy} className={styles.primary}>
                  {result.next === "finished" ? "See your score" : "Spin again"}
                </button>
              </div>
            )}
            {error && <p className={styles.error}>{error}</p>}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
