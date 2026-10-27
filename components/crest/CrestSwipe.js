"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { allowsBoth, PART_INDEX, PART_LABEL, TOTAL } from "@/lib/crest/cards";
import { DEFAULT_ALPHA, nextCard } from "@/lib/crest/match";
import { parseBallot } from "@/lib/crest/result-store";
import { decodeResume } from "@/lib/crest/resume";
import { EMPTY_ROOTS } from "@/lib/crest/roots";
import {
  clearPendingSave,
  fetchCrestStatus,
  readPendingSave,
  saveCrestResult,
  writePendingSave,
} from "@/lib/crest/save-client";
import { stakeLine } from "@/lib/crest/stakes";
import SwipeCard from "./SwipeCard";
import CrestArrival from "./CrestArrival";
import CrestHome, { readStoredScope, writeStoredScope } from "./CrestHome";
import CrestReport from "./CrestReport";
import CrestReveal from "./CrestReveal";
import CrestRoots from "./CrestRoots";
import CrestWant from "./CrestWant";
import styles from "./CrestSwipe.module.css";

const RUN_TOTAL = 4 + TOTAL;

/**
 * Find Your FC on The Reflective. Scope, roots, one want, twenty cards.
 * One saved result still lives on the account.
 *
 * @param {{embedded?: boolean, resumeToken?: string|null}} [props]
 */
export default function CrestSwipe({ embedded = false, resumeToken = null }) {
  const [step, setStep] = useState("scope");
  const [group, setGroup] = useState(null);
  const [stake, setStake] = useState(null);
  const [roots, setRoots] = useState(EMPTY_ROOTS);
  const [answers, setAnswers] = useState([]);
  const [drag, setDrag] = useState(0);
  const [runId, setRunId] = useState(0);
  const [saved, setSaved] = useState(null);
  const [saveState, setSaveState] = useState("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const [signedIn, setSignedIn] = useState(null);
  const boardRef = useRef(null);
  const booted = useRef(false);

  useEffect(() => {
    setGroup(readStoredScope());
  }, []);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;

    async function boot() {
      const status = await fetchCrestStatus();
      setSignedIn(status.signedIn);
      if (status.saved) setSaved(status.saved);

      let ballot = null;
      if (resumeToken) {
        try {
          ballot = decodeResume(resumeToken);
        } catch {
          ballot = null;
        }
      }
      if (!ballot) ballot = readPendingSave();
      if (!ballot?.answers) return;

      const parsed = parseBallot(ballot);
      if (parsed.error) {
        clearPendingSave();
        return;
      }

      setAnswers(parsed.answers);
      setStake(parsed.stake);
      if (parsed.scope) {
        setGroup(parsed.scope);
        writeStoredScope(parsed.scope);
      }
      setStep("arrival");

      const put = await saveCrestResult(parsed);
      if (put.ok) {
        setSaved(put.result);
        setSaveState("saved");
        setSignedIn(true);
        clearPendingSave();
        return;
      }
      if (put.needSignIn) {
        writePendingSave(parsed);
        setSignedIn(false);
        setSaveState("idle");
        return;
      }
      setSaveState("error");
      setSaveMessage(put.message);
    }

    boot();
  }, [resumeToken]);

  const current = useMemo(
    () => (step === "play" ? nextCard(answers, DEFAULT_ALPHA, { group, stake }) : null),
    [answers, group, stake, step],
  );

  const onDrag = useCallback((value) => setDrag(value), []);

  useEffect(() => {
    if (step !== "play") return;
    boardRef.current?.focus({ preventScroll: true });
  }, [step, current?.card?.id]);

  function setScope(next) {
    setGroup(next);
    writeStoredScope(next);
  }

  function startFresh() {
    setAnswers([]);
    setStake(null);
    setRoots(EMPTY_ROOTS);
    setDrag(0);
    setSaveState("idle");
    setSaveMessage("");
    setStep("roots");
  }

  function start() {
    if (saved && !window.confirm("This replaces your saved crest.")) return;
    startFresh();
  }

  function pickStake(id) {
    setStake(id);
    setAnswers([]);
    setDrag(0);
    setStep("play");
  }

  function answer(side) {
    if (!current) return;
    if (side === "both" && !allowsBoth(current.card)) return;
    const value = side === "both" ? 0 : side === "left" ? current.card.leftValue : -current.card.leftValue;
    const next = [...answers, { cardId: current.card.id, value }];
    setDrag(0);
    setAnswers(next);
    if (next.length >= TOTAL) {
      setRunId((id) => id + 1);
      setStep("reveal");
    }
  }

  function back() {
    if (answers.length === 0) {
      setStep("want");
      return;
    }
    setAnswers(answers.slice(0, -1));
    setDrag(0);
  }

  function restart() {
    if (saved && !window.confirm("This replaces your saved crest.")) return;
    setAnswers([]);
    setStake(null);
    setRoots(EMPTY_ROOTS);
    setDrag(0);
    setSaveState("idle");
    setSaveMessage("");
    setStep("scope");
  }

  function openSaved() {
    if (!saved?.answers) return;
    const parsed = parseBallot({
      answers: saved.answers,
      stake: saved.stake,
      scope: saved.scope,
    });
    if (parsed.error) return;
    setAnswers(parsed.answers);
    setStake(parsed.stake);
    setRoots(EMPTY_ROOTS);
    if (parsed.scope) setGroup(parsed.scope);
    setSaveState("saved");
    setStep("arrival");
  }

  async function saveResults() {
    const ballot = { answers, stake, scope: group };
    setSaveState("saving");
    setSaveMessage("");
    const put = await saveCrestResult(ballot);
    if (put.ok) {
      setSaved(put.result);
      setSaveState("saved");
      setSignedIn(true);
      clearPendingSave();
      return;
    }
    if (put.needSignIn) {
      writePendingSave(ballot);
      setSignedIn(false);
      setSaveState("idle");
      return;
    }
    setSaveState("error");
    setSaveMessage(put.message);
  }

  function onPlayKey(event) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "ArrowUp") return;
    if (event.key === "ArrowUp" && current && !allowsBoth(current.card)) return;
    event.preventDefault();
    const side = event.key === "ArrowLeft" ? "left" : event.key === "ArrowRight" ? "right" : "both";
    event.currentTarget.querySelector(`[data-choice="${side}"]`)?.click();
  }

  if (step === "report") {
    return (
      <div className={styles.board}>
        <CrestReport
          answers={answers}
          group={group}
          stake={stake}
          colour={null}
          onBack={() => setStep("arrival")}
          onRestart={restart}
        />
      </div>
    );
  }

  if (step === "reveal") {
    return <CrestReveal answers={answers} group={group} stake={stake} onDone={() => setStep("arrival")} />;
  }

  if (step === "arrival") {
    return (
      <div className={styles.board}>
        <CrestArrival
          answers={answers}
          group={group}
          stake={stake}
          roots={roots}
          runId={runId}
          saveState={saveState}
          saveMessage={saveMessage}
          signedIn={signedIn}
          onKeepResult={() => writePendingSave({ answers, stake, scope: group })}
          onSave={saveResults}
          onRestart={restart}
        />
      </div>
    );
  }

  if (step === "want") {
    return <CrestWant onPick={pickStake} onBack={() => setStep("roots")} />;
  }

  if (step === "roots") {
    return (
      <CrestRoots
        onBack={() => setStep("scope")}
        onDone={(next) => {
          setRoots(next);
          setStep("want");
        }}
      />
    );
  }

  if (step === "scope" || !current) {
    return (
      <CrestHome
        group={group}
        onScope={setScope}
        onStart={start}
        onOpenSaved={openSaved}
        saved={saved}
        backHref={embedded ? "/games" : null}
      />
    );
  }

  const index = answers.length;
  const card = current.card;
  const done = 4 + index;
  const percent = Math.round((done / RUN_TOTAL) * 100);
  const showTurn = card.part === "football" && index === 10;
  const chip = stakeLine(stake);

  return (
    <div
      ref={boardRef}
      className={styles.board}
      tabIndex={0}
      onKeyDown={onPlayKey}
      style={{
        "--wash-left": Math.max(0, -drag),
        "--wash-right": Math.max(0, drag),
      }}
    >
      <header className={styles.playHead}>
        <div className={styles.playHeadRow}>
          <button type="button" className={styles.iconButton} onClick={back} aria-label="Back">
            &larr;
          </button>
          <span className={styles.partLabel}>
            {PART_INDEX[card.part]} of 3 · {PART_LABEL[card.part]}
            <span className={styles.chipLine}>
              {done} of {RUN_TOTAL}
            </span>
            {chip ? <span className={styles.chipLine}>{chip}</span> : null}
          </span>
          <button type="button" className={styles.restart} onClick={restart}>
            Restart
          </button>
        </div>
        <div
          className={styles.progressBar}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={RUN_TOTAL}
          aria-valuenow={done}
        >
          <span style={{ width: `${percent}%` }} />
        </div>
      </header>

      <section className={styles.play} aria-live="polite">
        {showTurn ? <p className={styles.turn}>Now the club.</p> : null}
        <div className={styles.stage}>
          <SwipeCard key={card.id} card={card} index={index} onAnswer={answer} onDrag={onDrag} />
        </div>
      </section>
    </div>
  );
}
