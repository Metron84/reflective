"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import ProgrammeCTA from "@/components/ProgrammeCTA";
import { ANSWER_GRACE_MS, CLUE_MS, ROUND_MS, cluesAt, valueAt } from "@/lib/guesser/buzzer/engine";
import { filterNames } from "@/lib/guesser/buzzer/names";
import { armSound, getMuted, playSound, setMuted, subscribeMuted } from "@/lib/play/sound";
import styles from "./BuzzerGame.module.css";

const API = "/api/guesser/board";
const CLUE_LABELS = ["The Opening", "Identity", "Career", "The Moment"];

async function post(action, body = {}) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...body }),
  });
  return res.json().catch(() => null);
}

function MuteButton() {
  const muted = useSyncExternalStore(subscribeMuted, getMuted, () => false);
  useEffect(() => armSound(), []);
  return (
    <button
      type="button"
      className={styles.mute}
      onClick={() => setMuted(!muted)}
      aria-pressed={muted}
      aria-label={muted ? "Sound off. Turn sound on" : "Sound on. Turn sound off"}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M11 5 6 9H3v6h3l5 4V5z" fill="currentColor" />
        {muted ? (
          <path d="m16 9 5 6m0-6-5 6" />
        ) : (
          <>
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            <path d="M18.5 5.5a9 9 0 0 1 0 13" />
          </>
        )}
      </svg>
    </button>
  );
}

function shareText(view) {
  const marks = view.players.map((p) => (p.points >= 3 ? "🟩" : p.points >= 1 ? "🟨" : "⬛")).join("");
  return `The Guesser #${view.number}\n${view.score}/${view.maxScore} ${marks}\nthereflectivefootball.com/guesser`;
}

/**
 * The daily buzzer board. The server owns the clock: it decides which clues are showing, what the
 * points are worth at the tap, and whether an answer arrived in time. This component only draws that
 * state and asks the server to act.
 *
 * @param {{names: [string, string, string[], string][], signedIn: boolean}} props
 */
export default function BuzzerGame({ names, signedIn: signedInProp }) {
  const [view, setView] = useState(null);
  const [error, setError] = useState("");
  // Local drawing clock: when the last server reading arrived, now, and when the tap froze it.
  const [times, setTimes] = useState({ synced: 0, now: 0, froze: 0 });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState(null);
  const [freezing, setFreezing] = useState(false);
  const [copied, setCopied] = useState(false);
  const lastSecond = useRef(-1);
  const inputRef = useRef(null);
  const viewRef = useRef(null);

  const apply = useCallback((data) => {
    if (!data || data.ok === false) {
      setError("Something went wrong. Refresh to try again.");
      return null;
    }
    const prev = viewRef.current;
    const doneBefore = prev ? prev.players.filter((p) => p.state === "done").length : 0;
    const newlyDone = data.players.filter((p) => p.state === "done").length > doneBefore;
    if (newlyDone) {
      const finished = data.players.filter((p) => p.state === "done").at(-1);
      playSound(finished?.correct ? "correct" : "wrong");
    } else if (data.outcome === "wrong" || data.outcome === "late") {
      playSound("wrong");
    }
    viewRef.current = data;
    const at = performance.now();
    setTimes({ synced: at, now: at, froze: 0 });
    setView(data);
    setFreezing(false);
    setError("");
    return data;
  }, []);

  const sync = useCallback(() => {
    return fetch(API, { cache: "no-store" })
      .then((r) => r.json())
      .then(apply)
      .catch(() => setError("Lost the connection. Refresh to try again."));
  }, [apply]);

  // First load: ask the server where today's board stands.
  useEffect(() => {
    let alive = true;
    fetch(API, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => alive && apply(d))
      .catch(() => alive && setError("The board did not load. Refresh to try again."));
    return () => {
      alive = false;
    };
  }, [apply]);

  const cur = view?.current ?? null;
  const running = Boolean(cur && !cur.frozen && !freezing);

  // A steady local clock for drawing. It never decides anything.
  useEffect(() => {
    if (!cur) return undefined;
    const id = setInterval(() => setTimes((t) => ({ ...t, now: performance.now() })), 100);
    return () => clearInterval(id);
  }, [cur]);

  const sinceSync = times.now - times.synced;
  const elapsed = !cur
    ? 0
    : cur.frozen
      ? cur.elapsedMs
      : freezing
        ? Math.min(ROUND_MS, cur.elapsedMs + (times.froze - times.synced))
        : Math.min(ROUND_MS, cur.elapsedMs + sinceSync);
  const answerLeft = cur?.frozen ? Math.max(0, cur.answerRemainingMs - sinceSync) : 0;

  // Ask the server again when the next thing is due: a new clue, the end of the round, or the
  // end of the typing window. If the server's clock is a touch behind ours, ask again shortly.
  useEffect(() => {
    if (!cur || freezing) return undefined;
    let delay;
    if (cur.frozen) {
      delay = cur.answerRemainingMs + ANSWER_GRACE_MS + 200;
    } else {
      const nextBoundary = Math.min(ROUND_MS, (Math.floor(cur.elapsedMs / CLUE_MS) + 1) * CLUE_MS);
      delay = nextBoundary - cur.elapsedMs + 150;
    }
    const id = setTimeout(sync, Math.max(150, delay));
    return () => clearTimeout(id);
  }, [view, cur, freezing, sync]);

  // A tick for every second the clock runs.
  const second = Math.floor(elapsed / 1000);
  useEffect(() => {
    if (!running) {
      lastSecond.current = -1;
      return;
    }
    if (second !== lastSecond.current && second > 0) playSound("tick");
    lastSecond.current = second;
  }, [second, running]);

  const expected = cur && !cur.frozen ? cluesAt(elapsed) : 0;
  useEffect(() => {
    if (cur && !cur.frozen && !freezing && expected > cur.unlocked) {
      const id = setTimeout(sync, 300);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [expected, cur, freezing, sync]);

  async function start() {
    armSound();
    setBusy(true);
    setNotice("");
    setQuery("");
    setOptions(null);
    apply(await post("start"));
    setBusy(false);
  }

  async function tap() {
    if (!cur || cur.frozen || cur.lockedOut || freezing) return;
    playSound("buzz");
    setTimes((t) => ({ ...t, froze: performance.now() }));
    setFreezing(true);
    setNotice("");
    const data = apply(await post("buzz"));
    if (data?.current?.frozen) setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function submit(body) {
    if (busy) return;
    setBusy(true);
    const data = apply(await post("answer", body));
    setBusy(false);
    if (!data) return;
    setQuery("");
    setOptions(null);
    if (data.outcome === "unknown") setNotice("Pick a name from the list.");
    else if (data.outcome === "ambiguous") {
      setNotice("More than one player has that name. Pick one.");
      setOptions(data.options);
    } else if (data.outcome === "wrong") setNotice("Not him. The clock is moving again.");
    else if (data.outcome === "late") setNotice("Time ran out. The clock is moving again.");
    else setNotice("");
    if (data.outcome === "unknown" || data.outcome === "ambiguous") setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function copyShare() {
    const text = shareText(view);
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* the player closed the share sheet */
    }
  }

  const suggestions = options
    ? options.map((id) => names.find((n) => n[0] === id)).filter(Boolean)
    : filterNames(names, query, 5);

  if (error && !view) {
    return (
      <div className={styles.game}>
        <p className={styles.notice} role="alert">{error}</p>
      </div>
    );
  }
  if (!view) {
    return (
      <div className={styles.game}>
        <p className={styles.copy} aria-live="polite">Loading today&apos;s board.</p>
      </div>
    );
  }

  const signedIn = signedInProp || view.signedIn;
  const doneCount = view.players.filter((p) => p.state === "done").length;
  const lastDone = [...view.players].reverse().find((p) => p.state === "done");

  const header = (
    <>
      <div className={styles.top}>
        <div>
          <p className={styles.kicker}>
            The Guesser #{view.number}
            {view.status === "live" || view.status === "between" ? ` · Player ${view.index} of ${view.total}` : ""}
          </p>
          {view.status !== "intro" ? (
            <p className={styles.scoreline}>
              {view.score} / {view.maxScore} points
            </p>
          ) : null}
        </div>
        <MuteButton />
      </div>
      <ol className={styles.dots} aria-hidden="true">
        {view.players.map((p) => (
          <li
            key={p.n}
            className={`${styles.dot} ${p.state === "done" ? (p.points > 0 ? styles.dotGood : styles.dotMiss) : p.n === view.index ? styles.dotNow : ""}`}
          />
        ))}
      </ol>
      {error ? <p className={styles.notice} role="alert">{error}</p> : null}
    </>
  );

  if (view.status === "intro") {
    return (
      <div className={styles.game}>
        {header}
        <section className={styles.panel}>
          <h2 className={styles.title}>Five players. Twenty points.</h2>
          <p className={styles.copy}>
            A clue lands every 5 seconds, and the points on offer drain with it. Tap to answer to
            freeze the clock, then name the player. A wrong answer costs nothing, but you only get one.
          </p>
          <button type="button" className={styles.primary} onClick={start} disabled={busy}>
            Start today&apos;s board
          </button>
        </section>
      </div>
    );
  }

  if (view.status === "between") {
    const reveal = lastDone;
    return (
      <div className={styles.game}>
        {header}
        {reveal ? (
          <section className={`${styles.panel} ${styles.reveal}`} aria-live="polite">
            <p className={styles.kicker}>
              {reveal.correct ? `Correct. ${reveal.points} point${reveal.points === 1 ? "" : "s"}` : "No points this time"}
            </p>
            <p className={styles.revealName}>{reveal.name}</p>
          </section>
        ) : null}
        <button type="button" className={styles.primary} onClick={start} disabled={busy}>
          {doneCount === 0 ? "Start" : `Player ${view.index}`}
        </button>
      </div>
    );
  }

  if (view.status === "complete") {
    return (
      <div className={styles.game}>
        {header}
        <section className={styles.panel}>
          <p className={styles.kicker}>Full time</p>
          <p className={styles.big} data-testid="buzzer-score">{view.score}/{view.maxScore}</p>
          <ul className={styles.rows}>
            {view.players.map((p) => (
              <li key={p.n} className={styles.row}>
                <span>{p.name}</span>
                <span className={styles.rowPts}>{p.points}</span>
              </li>
            ))}
          </ul>
          <button type="button" className={`${styles.primary} ${styles.ghost}`} onClick={copyShare}>
            {copied ? "Copied" : "Share your score"}
          </button>
        </section>
        <ProgrammeCTA signedIn={signedIn} />
        <p className={styles.copy}>A new board arrives at midnight Dubai time.</p>
        <div className={styles.links}>
          <Link href="/reflections" className={`${styles.primary} ${styles.ghost}`}>Vote in The Reflectives</Link>
          <Link href="/films" className={`${styles.primary} ${styles.ghost}`}>Watch the films</Link>
        </div>
      </div>
    );
  }

  // Live round.
  const value = valueAt(elapsed);
  const unlocked = Math.max(cur.unlocked, 1);
  const inFinal = elapsed >= CLUE_MS * 4;
  const finalLeft = inFinal ? Math.max(0, 1 - (elapsed - CLUE_MS * 4) / CLUE_MS) : 1;
  const showAnswer = cur.frozen;

  return (
    <div className={styles.game}>
      {header}

      <ul className={styles.clues} aria-label="Clues">
        {[0, 1, 2, 3].map((i) =>
          i < cur.clues.length ? (
            <li key={i} className={`${styles.clue} ${i === unlocked - 1 && i > 0 ? styles.clueNew : ""}`}>
              <span className={styles.clueLabel}>Clue {i + 1} · {CLUE_LABELS[i]}</span>
              {cur.clues[i]}
            </li>
          ) : (
            <li key={i} className={styles.slot}>
              Clue {i + 1} · {CLUE_LABELS[i]} in {Math.max(1, Math.ceil((i * CLUE_MS - elapsed) / 1000))}s
            </li>
          ),
        )}
      </ul>

      <div className={styles.meter}>
        <p className={styles.worth} aria-live="off">
          {value} point{value === 1 ? "" : "s"} {cur.frozen || freezing ? "frozen" : "on offer"}
        </p>
        <div className={styles.cylinders} aria-hidden="true">
          {[4, 3, 2, 1].map((pts, i) => {
            const into = elapsed - i * CLUE_MS;
            const fill = into <= 0 ? 1 : into >= CLUE_MS ? 0 : 1 - into / CLUE_MS;
            const active = into >= 0 && into < CLUE_MS;
            return (
              <div key={pts} className={styles.cyl}>
                <div className={`${styles.tube} ${active ? styles.tubeActive : ""}`}>
                  <div className={styles.liquid} style={{ height: `${Math.round(fill * 100)}%` }} />
                </div>
                <span className={styles.cylLabel}>{pts}</span>
              </div>
            );
          })}
        </div>
        <div className={styles.final} aria-hidden="true">
          <div className={styles.finalBar}>
            <div className={styles.finalFill} style={{ width: `${Math.round(finalLeft * 100)}%` }} />
          </div>
          <p className={styles.finalLabel}>Final window · 1 point</p>
        </div>
      </div>

      {showAnswer ? (
        <form
          className={styles.answer}
          onSubmit={(e) => {
            e.preventDefault();
            if (query.trim()) submit({ text: query });
          }}
        >
          <p className={styles.frozen}>
            <span>Frozen at {cur.value} point{cur.value === 1 ? "" : "s"}</span>
            <span className={styles.countdown} aria-label={`${Math.ceil(answerLeft / 1000)} seconds left`}>
              {Math.ceil(answerLeft / 1000)}
            </span>
          </p>
          <input
            ref={inputRef}
            className={styles.input}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type the player's name"
            autoComplete="off"
            autoCapitalize="words"
            spellCheck={false}
            aria-label="Player name"
            enterKeyHint="go"
          />
          {suggestions.length ? (
            <ul className={styles.picks}>
              {suggestions.map(([id, name, , context]) => (
                <li key={id}>
                  <button type="button" className={styles.pick} onClick={() => submit({ personId: id })} disabled={busy}>
                    <span>{name}</span>
                    <span className={styles.pickCtx}>{context}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <button type="submit" className={styles.primary} disabled={busy || !query.trim()}>
            Answer
          </button>
          {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
        </form>
      ) : (
        <>
          <button type="button" className={styles.tap} onClick={tap} disabled={cur.lockedOut || freezing}>
            {cur.lockedOut ? "Locked out" : "Tap to answer"}
            <span className={styles.tapSub}>
              {cur.lockedOut ? "Watch the rest of the clues land" : `${value} point${value === 1 ? "" : "s"} right now`}
            </span>
          </button>
          {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
        </>
      )}

      <p className={styles.sr} aria-live="polite">
        Clue {unlocked} showing. {value} points on offer.
      </p>
    </div>
  );
}
