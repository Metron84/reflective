"use client";

import Link from "next/link";
import { SITE_URL } from "@/lib/config";
import SaveResult from "@/components/watch-with/SaveResult";
import { useEffect, useRef, useState } from "react";

const font = { fontFamily: "var(--font-body), Archivo, sans-serif" };

function sidesFor(pair, incumbentId) {
  if (!pair || pair.length < 2) return [null, null];
  const incumbent = pair.find((card) => card.id === incumbentId) ?? null;
  const other = pair.find((card) => card.id !== incumbent?.id) ?? pair[1];
  const lead = incumbent ?? pair[0];
  const chase = incumbent ? other : pair[1];
  return Math.random() < 0.5 ? [lead, chase] : [chase, lead];
}

async function post(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : "{}",
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.error || "fail");
    error.status = response.status;
    error.code = data?.code;
    error.state = data?.state;
    throw error;
  }
  return data;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text).split(" ");
  let line = "";
  let top = y;
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width > maxWidth && line) {
      ctx.fillText(line, x, top);
      line = word;
      top += lineHeight;
    } else {
      line = trial;
    }
  }
  if (line) ctx.fillText(line, x, top);
}

function inkOn(hex) {
  const value = String(hex || "").replace("#", "");
  if (value.length !== 6) return "#F2EDE4";
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  const light = (red * 299 + green * 587 + blue * 114) / 1000;
  return light > 160 ? "#0A111F" : "#F2EDE4";
}

async function drawShareCard({ name, tagline, primary, shareHost }) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = primary || "#7A263A";
  ctx.fillRect(0, 0, 1080, 1350);
  try {
    const logo = await loadImage("/brand/trf-crest-transparent.png");
    ctx.drawImage(logo, 440, 72, 200, 200);
  } catch {
    ctx.fillStyle = "#0A111F";
    ctx.beginPath();
    ctx.arc(540, 172, 72, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.textAlign = "center";
  ctx.fillStyle = "#F2EDE4";
  ctx.font = "600 34px Archivo, sans-serif";
  ctx.fillText("Your matchday companion", 540, 360);
  ctx.font = "700 68px Archivo, sans-serif";
  wrapText(ctx, name, 540, 470, 920, 80);
  ctx.font = "500 34px Archivo, sans-serif";
  wrapText(ctx, tagline, 540, 760, 880, 48);
  ctx.fillStyle = "#F2EDE4";
  ctx.fillRect(390, 1040, 300, 10);
  ctx.font = "500 28px Archivo, sans-serif";
  ctx.fillText(shareHost, 540, 1160);
  ctx.font = "500 24px Archivo, sans-serif";
  ctx.fillText("Football is nothing without the fans.", 540, 1248);
  return canvas;
}

function categoryLabel(category) {
  if (category === "player") return "Player";
  if (category === "manager") return "Manager";
  if (category === "celebrity") return "Celebrity";
  return category;
}

const SIDES = ["fan", "neutral", "rival"];

function readSide(club) {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )ww_aff_${club}=([^;]*)`));
    const value = match ? decodeURIComponent(match[1]) : "";
    return SIDES.includes(value) ? value : "";
  } catch {
    return "";
  }
}

function writeSide(club, value) {
  document.cookie = `ww_aff_${club}=${encodeURIComponent(value)}; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax`;
}

export default function WatchGame({
  club,
  clubName,
  shortName,
  headline,
  subline,
  rankingHref = `/watch-with/${club}/ranking`,
  accent = "#D8232A",
  primary = "#7A263A",
  shareHost = `watchwith.thereflectivefootball.com/${club}`,
  preview = "",
  accountEmail = "",
}) {
  const [run, setRun] = useState(null);
  const [left, setLeft] = useState(null);
  const [right, setRight] = useState(null);
  const [busy, setBusy] = useState(true);
  const [winnerSide, setWinnerSide] = useState(null);
  const [failed, setFailed] = useState("");
  const [capped, setCapped] = useState(false);
  const [shared, setShared] = useState("");
  const [side, setSide] = useState("");
  const [askingSide, setAskingSide] = useState(false);
  const retryRef = useRef(null);
  const dragRef = useRef(null);
  const previewRef = useRef(null);
  const shareBlob = useRef(null);

  function showPair(state) {
    const [nextLeft, nextRight] = sidesFor(state.pair, state.incumbentId);
    setLeft(nextLeft);
    setRight(nextRight);
    setRun(state);
  }

  async function begin(nextSide) {
    const affiliation = nextSide || side || readSide(club);
    setBusy(true);
    setFailed("");
    setCapped(false);
    setShared("");
    shareBlob.current = null;
    try {
      const data = await post(`/api/watch-with/${club}/start`, { affiliation, preview });
      if (data.needsAffiliation) {
        setAskingSide(true);
        setBusy(false);
        return;
      }
      setAskingSide(false);
      if (data.needsComplete && data.champion) {
        const finished = await post(`/api/watch-with/${club}/complete`, {
          runId: data.runId,
          championId: data.champion.id,
          preview,
        });
        setRun(finished);
      } else {
        showPair(data);
      }
    } catch (error) {
      if (error.code === "daily-cap") {
        setCapped(true);
        setFailed("");
      } else {
        retryRef.current = begin;
        setFailed(error.message || "Something went wrong. Tap to try again.");
      }
    }
    setBusy(false);
  }

  useEffect(() => {
    begin();
    // The first deck comes from the server on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [club]);

  async function choose(card) {
    if (!run || busy || !left || !right || !card) return;
    const other = card.id === left.id ? right : left;
    setBusy(true);
    setFailed("");
    setWinnerSide(card.id === left.id ? "left" : "right");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced) await new Promise((resolve) => setTimeout(resolve, 280));
    try {
      const data = await post(`/api/watch-with/${club}/pick`, {
        runId: run.runId,
        winnerId: card.id,
        loserId: other.id,
        preview,
      });
      if (data.needsComplete && data.champion) {
        const finished = await post(`/api/watch-with/${club}/complete`, {
          runId: data.runId,
          championId: data.champion.id,
          preview,
        });
        setRun(finished);
        setLeft(null);
        setRight(null);
      } else if (data.state) {
        showPair(data.state);
      } else {
        showPair(data);
      }
    } catch (error) {
      if (error.state) showPair(error.state);
      if (error.code === "daily-cap") setCapped(true);
      retryRef.current = () => choose(card);
      setFailed(error.message || "Something went wrong. Tap to try again.");
    }
    setWinnerSide(null);
    setBusy(false);
  }

  function onPointerDown(event) {
    dragRef.current = { x: event.clientX, y: event.clientY };
  }

  function onPointerUp(event) {
    const start = dragRef.current;
    dragRef.current = null;
    if (!start || busy) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy)) return;
    choose(dx < 0 ? left : right);
  }

  async function pickSide(value) {
    writeSide(club, value);
    setSide(value);
    setAskingSide(false);
    if (!run?.done) await begin(value);
  }

  async function share() {
    if (!run?.champion) return;
    const pageUrl = new URL(rankingHref.replace(/\/ranking$/, "") || "/", window.location.origin).href;
    let blob = shareBlob.current;
    if (!blob) {
      const canvas = await drawShareCard({
        name: run.champion.name,
        tagline: run.champion.tagline,
        primary,
        shareHost,
      });
      blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    }
    const file = new File([blob], "matchday-companion.png", { type: "image/png" });
    const text = `My matchday companion is ${run.champion.name}.`;
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text, url: pageUrl });
        setShared("Shared");
        return;
      }
    } catch {
      // Fall through to a download when share is dismissed or unavailable.
    }
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "matchday-companion.png";
    link.click();
    URL.revokeObjectURL(link.href);
    setShared("Image saved");
  }

  const showingResult = Boolean(run?.champion && run.done && !run.pair);

  useEffect(() => {
    if (!showingResult || !run?.champion) return undefined;
    let cancel = false;
    drawShareCard({
      name: run.champion.name,
      tagline: run.champion.tagline,
      primary,
      shareHost,
    }).then((canvas) => {
      if (cancel) return;
      const preview = previewRef.current;
      if (preview) {
        preview.width = canvas.width;
        preview.height = canvas.height;
        preview.getContext("2d").drawImage(canvas, 0, 0);
      }
      canvas.toBlob((blob) => {
        shareBlob.current = blob;
      }, "image/png");
    });
    return () => {
      cancel = true;
    };
  }, [showingResult, run?.champion, primary, shareHost]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-4 py-5" style={font}>
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: accent }}>{clubName}</p>
        <h1 className="text-3xl font-semibold leading-tight text-[#0A111F]">{headline}</h1>
        <p className="text-base leading-snug text-[#0A111F]">{subline}</p>
      </header>

      {askingSide ? (
        <section className="mt-8 flex flex-col gap-3">
          <h2 className="text-2xl font-semibold text-[#0A111F]">Which side are you on?</h2>
          <button type="button" onClick={() => pickSide("fan")} className={sideButton}>I support {shortName}</button>
          <button type="button" onClick={() => pickSide("neutral")} className={sideButton}>Neutral</button>
          <button type="button" onClick={() => pickSide("rival")} className={sideButton}>I support a rival</button>
        </section>
      ) : null}

      {run && !showingResult && !askingSide ? (
        <div className="mt-5">
          <p className="mb-2 text-sm font-medium text-[#0A111F]">Pick {run.pick} of {run.totalPicks}</p>
          <div className="flex gap-1" aria-hidden="true">
            {Array.from({ length: run.totalPicks }, (_, index) => (
              <span
                key={index}
                className="h-1.5 flex-1 rounded-full"
                style={{ background: index < run.pick ? accent : "rgba(10,17,31,0.15)" }}
              />
            ))}
          </div>
        </div>
      ) : null}

      {showingResult && run.champion && !askingSide ? (
        <section className="mt-6 flex flex-1 flex-col gap-4">
          <p className="text-sm font-medium text-[#0A111F]">Your matchday companion</p>
          <article className="rounded-[14px] bg-[#0A111F] p-6 text-[#F2EDE4]">
            <p className="text-xs uppercase tracking-[0.16em]" style={{ color: accent }}>{categoryLabel(run.champion.category)}</p>
            <h2 className="mt-2 text-4xl font-semibold leading-tight">{run.champion.name}</h2>
            <p className="mt-3 text-lg leading-snug">{run.champion.tagline}</p>
          </article>
          <canvas ref={previewRef} className="h-auto w-full rounded-[14px] border-2 border-[#0A111F]" aria-label={`Share card for ${run.champion.name}`} />
          <button type="button" onClick={share} className={primaryClass}>Share my companion</button>
          <SaveResult club={club} runId={run.runId} accountEmail={accountEmail} preview={preview} />
          {shared ? <p className="text-sm">{shared}</p> : null}
          <button type="button" onClick={begin} className={ghostClass}>Play again</button>
          <p className="text-sm text-[#0A111F]">
            {sideLabel(side || readSide(club), shortName)}{" "}
            <button type="button" onClick={() => setAskingSide(true)} className="font-semibold underline-offset-4 hover:underline">Change</button>
          </p>
          <Link href={rankingHref} className={linkClass}>See the ranking</Link>
        </section>
      ) : null}

      {!showingResult && !askingSide && left && right ? (
        <div
          className="mt-4 flex flex-1 flex-col"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
        >
          <div className="grid flex-1 grid-cols-2 gap-3">
            <Card card={left} side="left" winning={winnerSide === "left"} accent={accent} />
            <Card card={right} side="right" winning={winnerSide === "right"} accent={accent} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <button type="button" disabled={busy} onClick={() => choose(left)} className={leftButton}>
              {left.name}
            </button>
            <button type="button" disabled={busy} onClick={() => choose(right)} className={rightButton} style={{ background: accent, borderColor: accent, color: inkOn(accent) }}>
              {right.name}
            </button>
          </div>
        </div>
      ) : null}

      {capped ? (
        <section className="mt-8 flex flex-col gap-4">
          <p className="text-lg">That&apos;s five for today. Come back tomorrow.</p>
          <Link href={rankingHref} className={linkClass}>See the ranking</Link>
        </section>
      ) : null}

      {failed ? (
        <div className="mt-4 flex flex-col gap-3">
          <p>Something went wrong. Tap to try again.</p>
          <button type="button" onClick={() => retryRef.current?.()} className={primaryClass}>Try again</button>
        </div>
      ) : null}

      {busy && !left && !showingResult && !capped ? <p className="mt-8 text-sm">Shuffling the deck.</p> : null}

      <footer className="mt-8 pb-4 text-center text-sm text-[#0A111F]">
        <p>Football is nothing without the fans.</p>
        <Link href={SITE_URL} className="mt-2 inline-block underline-offset-4 hover:underline">The Reflective Football</Link>
      </footer>
    </div>
  );
}

function sideLabel(value, name) {
  if (value === "fan") return `I support ${name}`;
  if (value === "rival") return "I support a rival";
  if (value === "neutral") return "Neutral";
  return "";
}

function Card({ card, winning, accent }) {
  return (
    <article
      className={`flex min-h-[46vh] flex-col justify-end rounded-[14px] border-2 p-4 motion-reduce:transition-none ${winning ? "scale-[1.03] transition-transform" : ""}`}
      style={{
        background: winning ? accent : "#0A111F",
        borderColor: winning ? accent : "#0A111F",
        color: winning ? inkOn(accent) : "#F2EDE4",
      }}
    >
      <p className="text-[11px] uppercase tracking-[0.16em] opacity-70">{categoryLabel(card.category)}</p>
      <h2 className="mt-2 text-2xl font-semibold leading-tight">{card.name}</h2>
      <p className="mt-2 text-sm leading-snug opacity-90">{card.tagline}</p>
    </article>
  );
}

const primaryClass =
  "min-h-12 rounded-[14px] bg-[#D8232A] px-4 text-base font-semibold text-[#F2EDE4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A111F]";

const ghostClass =
  "min-h-12 rounded-[14px] border-2 border-[#0A111F] px-4 text-base font-semibold text-[#0A111F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8232A]";

const linkClass =
  "min-h-12 text-center text-sm font-semibold text-[#0A111F] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8232A]";

const leftButton =
  "min-h-14 rounded-[14px] border-2 border-[#0A111F] bg-[#0A111F] px-2 text-sm font-semibold text-[#F2EDE4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8232A] disabled:opacity-60";

const rightButton =
  "min-h-14 rounded-[14px] border-2 px-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A111F] disabled:opacity-60";

const sideButton =
  "min-h-14 w-full rounded-[14px] border-2 border-[#0A111F] px-4 text-left text-base font-semibold text-[#0A111F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8232A]";
