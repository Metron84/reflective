"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const SESSION_KEY = "trf_obs_footballer001_session";
const START = "/api/observatory/footballer-001/start";
const ANSWER = "/api/observatory/footballer-001/answer";
const FINISH = "/api/observatory/footballer-001/finish";
const ABOUT = "/api/observatory/footballer-001/about";

function readSession() {
  try {
    const existing = window.localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.localStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

function shuffle(list) {
  const next = [...list];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = next[i];
    next[i] = next[j];
    next[j] = swap;
  }
  return next;
}

function withOrder(question) {
  return { ...question, options: shuffle(question.options) };
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error("fail");
  return data;
}

export default function FootballerStudy() {
  const [stage, setStage] = useState("intro");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [history, setHistory] = useState([]);
  const [cursor, setCursor] = useState(0);
  const [about, setAbout] = useState(null);
  const [perception, setPerception] = useState(null);
  const [club, setClub] = useState("");
  const [age, setAge] = useState("");
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const sessionRef = useRef("");
  const retryRef = useRef(null);

  useEffect(() => {
    sessionRef.current = readSession();
  }, []);

  function failAndRetry(action) {
    retryRef.current = action;
    setFailed(true);
    setBusy(false);
  }

  async function begin() {
    setBusy(true);
    setFailed(false);
    try {
      const data = await postJson(START, {
        sessionId: sessionRef.current || readSession(),
        consent: true,
        locale: "en",
      });
      if (data.status === "complete") {
        setResult(data.result);
        setStage("result");
      } else {
        setHistory([withOrder(data.question)]);
        setCursor(0);
        setStage("question");
      }
    } catch {
      failAndRetry(begin);
      return;
    }
    setBusy(false);
  }

  async function choose(option, shownPosition) {
    const question = history[cursor];
    if (!question || busy) return;
    setBusy(true);
    setFailed(false);
    const run = () => choose(option, shownPosition);
    try {
      const data = await postJson(ANSWER, {
        sessionId: sessionRef.current,
        step: question.step,
        questionId: question.questionId,
        optionId: option.id,
        shownPosition,
      });
      if (data.status === "about") {
        setHistory((prev) => prev.slice(0, cursor + 1));
        await loadAbout();
        setStage("perception");
      } else {
        setHistory((prev) => [...prev.slice(0, cursor + 1), withOrder(data.question)]);
        setCursor(cursor + 1);
      }
    } catch {
      failAndRetry(run);
      return;
    }
    setBusy(false);
  }

  async function loadAbout() {
    if (about) return about;
    const response = await fetch(ABOUT);
    if (!response.ok) throw new Error("fail");
    const pack = await response.json();
    const mixed = {
      ...pack,
      perception: { ...pack.perception, options: shuffle(pack.perception.options) },
    };
    setAbout(mixed);
    return mixed;
  }

  async function finish(tedLasso) {
    setBusy(true);
    setFailed(false);
    const run = () => finish(tedLasso);
    try {
      const data = await postJson(FINISH, {
        sessionId: sessionRef.current,
        perception: perception?.id ?? null,
        club,
        ageBracket: age,
        tedLasso,
      });
      setResult(data.result);
      setStage("result");
    } catch {
      failAndRetry(run);
      return;
    }
    setBusy(false);
  }

  async function share() {
    const url = window.location.href;
    const text = `I want ${result.primary.name}. What footballer do you want?`;
    try {
      if (navigator.share) {
        await navigator.share({ text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      } catch {
        setCopied(false);
      }
    }
  }

  const stepNumber =
    stage === "question"
      ? history[cursor]?.step ?? 1
      : stage === "perception"
        ? 7
        : stage === "club"
          ? 8
          : stage === "age"
            ? 9
            : stage === "ted"
              ? 10
              : 0;

  const current = history[cursor];
  const options = current?.options ?? [];
  const seen = about?.perception?.options ?? [];

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-8 sm:py-12" style={{ fontFamily: "var(--font-body), Archivo, sans-serif" }}>
      <p className="text-xs tracking-[0.22em] text-[#0A111F]" style={{ fontFamily: "var(--font-obs-word), Montserrat, sans-serif" }}>
        TRF
      </p>

      {stepNumber > 0 && stage !== "result" ? (
        <div>
          <p className="mb-2 text-sm font-medium text-[#0A111F]">Question {stepNumber} of 10</p>
          <div className="flex gap-1" aria-hidden="true">
            {Array.from({ length: 10 }, (_, index) => (
              <span
                key={index}
                className="h-1.5 flex-1 rounded-full"
                style={{ background: index < stepNumber ? "#D8232A" : "rgba(10,17,31,0.15)" }}
              />
            ))}
          </div>
        </div>
      ) : null}

      {stage === "intro" ? (
        <section className="flex flex-col gap-5">
          <h1 className="text-4xl font-semibold leading-tight text-[#0A111F] sm:text-5xl">What should a footballer be?</h1>
          <p className="text-lg leading-snug text-[#0A111F]">
            Ten quick questions about the kind of player you want to cheer for. There are no right answers. Go with your gut.
          </p>
          <ul className="flex flex-col gap-2 text-[#0A111F]">
            <li>Takes about 2 minutes</li>
            <li>Six questions about players, four about you</li>
            <li>Find out which type of footballer you really want</li>
          </ul>
          <p className="text-sm text-[#0A111F]/80">Your answers are anonymous and used for TRF research.</p>
          <button type="button" onClick={begin} disabled={busy} className={primaryClass}>
            Start
          </button>
        </section>
      ) : null}

      {stage === "question" && current ? (
        <section className="flex flex-col gap-4">
          <h1 className="text-2xl font-semibold leading-snug text-[#0A111F] sm:text-3xl">{current.text}</h1>
          <div className="flex flex-col gap-3">
            {options.map((option, index) => (
              <button
                key={option.id}
                type="button"
                disabled={busy}
                onClick={() => choose(option, index + 1)}
                className={optionClass}
              >
                {option.text}
              </button>
            ))}
          </div>
          {cursor > 0 ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => setCursor((value) => Math.max(0, value - 1))}
              className="min-h-11 self-start text-sm font-medium text-[#0A111F] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8232A]"
            >
              Back
            </button>
          ) : null}
        </section>
      ) : null}

      {stage === "perception" && about ? (
        <section className="flex flex-col gap-4">
          <h1 className="text-2xl font-semibold leading-snug text-[#0A111F] sm:text-3xl">{about.perception.text}</h1>
          <div className="flex flex-col gap-3">
            {seen.map((option) => (
              <button
                key={option.id}
                type="button"
                disabled={busy}
                onClick={() => {
                  setPerception(option);
                  setStage("club");
                }}
                className={option.id === perception?.id ? pickedClass : optionClass}
              >
                {option.text}
              </button>
            ))}
          </div>
          <button type="button" disabled={busy} onClick={() => setStage("question")} className="min-h-11 self-start text-sm font-medium underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8232A]">
            Back
          </button>
        </section>
      ) : null}

      {stage === "club" ? (
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            setStage("age");
          }}
        >
          <h1 className="text-2xl font-semibold leading-snug text-[#0A111F] sm:text-3xl">Which club do you support?</h1>
          <input
            value={club}
            onChange={(event) => setClub(event.target.value.slice(0, 60))}
            placeholder="Type your club"
            className="min-h-12 rounded-[14px] border-2 border-[#0A111F] bg-transparent px-4 text-lg text-[#0A111F] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8232A]"
          />
          <button type="submit" className={primaryClass}>Next</button>
          <button type="button" onClick={() => setStage("perception")} className="min-h-11 self-start text-sm font-medium underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8232A]">
            Back
          </button>
        </form>
      ) : null}

      {stage === "age" && about ? (
        <section className="flex flex-col gap-4">
          <h1 className="text-2xl font-semibold leading-snug text-[#0A111F] sm:text-3xl">How old are you?</h1>
          <div className="flex flex-col gap-3">
            {about.ageBrackets.map((bracket) => (
              <button
                key={bracket}
                type="button"
                disabled={busy}
                onClick={() => {
                  setAge(bracket);
                  setStage("ted");
                }}
                className={bracket === age ? pickedClass : optionClass}
              >
                {bracket}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setStage("club")} className="min-h-11 self-start text-sm font-medium underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8232A]">
            Back
          </button>
        </section>
      ) : null}

      {stage === "ted" && about ? (
        <section className="flex flex-col gap-4">
          <h1 className="text-2xl font-semibold leading-snug text-[#0A111F] sm:text-3xl">Have you watched Ted Lasso?</h1>
          <div className="flex flex-col gap-3">
            {about.tedLasso.map((choice) => (
              <button key={choice} type="button" disabled={busy} onClick={() => finish(choice)} className={optionClass}>
                {choice}
              </button>
            ))}
          </div>
          <button type="button" disabled={busy} onClick={() => setStage("age")} className="min-h-11 self-start text-sm font-medium underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8232A]">
            Back
          </button>
        </section>
      ) : null}

      {stage === "result" && result ? (
        <section className="flex flex-col gap-6">
          <div className="rounded-[14px] bg-[#0A111F] p-6 text-[#F2EDE4] sm:p-8">
            <p className="text-sm">The footballer you want is</p>
            <h1 className="mt-2 text-4xl font-semibold leading-tight sm:text-5xl">{result.primary.name}</h1>
            <p className="mt-3 text-lg leading-snug">{result.primary.line}</p>
            <p className="mt-6 text-sm">With a side of {result.secondary.name}.</p>
            <p className="mt-2 leading-snug">{result.secondary.line}</p>
          </div>
          {result.perception ? (
            <div className="rounded-[14px] border-2 border-[#0A111F] p-5">
              {result.matches ? (
                <p>Your club matches you. You want {result.primary.name} and that is what you see.</p>
              ) : (
                <p>
                  There is a gap. You want {result.primary.name}. You said your club&apos;s players look more like {result.perception.text.replace(/\.$/, "")}.
                </p>
              )}
            </div>
          ) : null}
          <button type="button" onClick={share} className={primaryClass}>
            {copied ? "Link copied" : "Share my result"}
          </button>
          <Link href="/observatory" className="min-h-11 text-center text-sm font-medium text-[#0A111F] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8232A]">
            Explore The Observatory
          </Link>
        </section>
      ) : null}

      {failed ? (
        <div className="flex flex-col gap-3">
          <p>Something went wrong. Tap to try again.</p>
          <button
            type="button"
            onClick={() => {
              const action = retryRef.current;
              if (action) action();
            }}
            className={primaryClass}
          >
            Try again
          </button>
        </div>
      ) : null}
    </div>
  );
}

const optionClass =
  "min-h-14 w-full rounded-[14px] border-2 border-[#0A111F] px-4 py-3 text-left text-base text-[#0A111F] transition-colors motion-reduce:transition-none hover:bg-[#0A111F]/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8232A] disabled:opacity-60";

const pickedClass =
  "min-h-14 w-full rounded-[14px] border-2 border-[#D8232A] bg-[#D8232A] px-4 py-3 text-left text-base text-[#F2EDE4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A111F] disabled:opacity-60";

const primaryClass =
  "min-h-12 rounded-[14px] bg-[#D8232A] px-6 text-base font-semibold text-[#F2EDE4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A111F] disabled:opacity-60";
