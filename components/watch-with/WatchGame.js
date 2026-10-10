"use client";

import Link from "next/link";
import { SITE_URL } from "@/lib/config";
import SaveResult from "@/components/watch-with/SaveResult";
import { useEffect, useRef, useState } from "react";

const font = { fontFamily: "var(--font-body), Archivo, sans-serif" };
const SOUND_KEY = "ww-sound";
const FULL_FIRST = new Set(["son", "van", "sir", "prince"]);

function sidesFor(pair, incumbentId) {
  if (!pair || pair.length < 2) return [null, null];
  const incumbent = pair.find((card) => card.id === incumbentId) ?? null;
  const other = pair.find((card) => card.id !== incumbent?.id) ?? pair[1];
  const lead = incumbent ?? pair[0];
  const chase = incumbent ? other : pair[1];
  return Math.random() < 0.5 ? [lead, chase] : [chase, lead];
}

function holdSides(pair, incumbentId, side) {
  if (!pair || pair.length < 2 || !incumbentId || (side !== "left" && side !== "right")) return null;
  const incumbent = pair.find((card) => card.id === incumbentId);
  const challenger = pair.find((card) => card.id !== incumbentId);
  if (!incumbent || !challenger) return null;
  return side === "left" ? [incumbent, challenger] : [challenger, incumbent];
}

function buttonName(name) {
  const full = String(name || "").trim();
  const first = full.split(/\s+/)[0] || full;
  if (!first || first.endsWith(".") || FULL_FIRST.has(first.toLowerCase())) return full;
  return first;
}

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function wait(ms) {
  if (reducedMotion() || ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  return top;
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
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

async function drawShareCard({ name, tagline, category, primary, shareHost }) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = primary || "#7A263A";
  ctx.fillRect(0, 0, 1080, 1350);
  ctx.strokeStyle = "#F2EDE4";
  ctx.lineWidth = 10;
  ctx.strokeRect(40, 40, 1000, 1270);
  try {
    const logo = await loadImage("/brand/trf-crest-transparent.png");
    ctx.drawImage(logo, 456, 96, 168, 168);
  } catch {
    ctx.fillStyle = "#0A111F";
    ctx.beginPath();
    ctx.arc(540, 180, 64, 0, Math.PI * 2);
    ctx.fill();
  }
  const label = categoryLabel(category);
  ctx.font = "600 28px Archivo, sans-serif";
  const pillWidth = Math.ceil(ctx.measureText(label).width) + 56;
  ctx.fillStyle = "#F2EDE4";
  roundRect(ctx, 540 - pillWidth / 2, 310, pillWidth, 56, 28);
  ctx.fill();
  ctx.fillStyle = primary || "#7A263A";
  ctx.textAlign = "center";
  ctx.fillText(label, 540, 348);
  ctx.fillStyle = "#F2EDE4";
  ctx.font = "600 34px Archivo, sans-serif";
  ctx.fillText("Your matchday companion", 540, 440);
  ctx.font = "700 84px Archivo, sans-serif";
  const nameBottom = wrapText(ctx, name, 540, 560, 900, 96);
  ctx.font = "500 36px Archivo, sans-serif";
  wrapText(ctx, tagline, 540, Math.max(nameBottom + 72, 820), 860, 50);
  ctx.font = "500 28px Archivo, sans-serif";
  ctx.fillText(shareHost, 540, 1220);
  return canvas;
}

function categoryLabel(category) {
  if (category === "player") return "Player";
  if (category === "manager") return "Manager";
  if (category === "celebrity") return "Celebrity";
  return category || "";
}

let audioCtx = null;

function ensureAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function playTap() {
  const ctx = ensureAudio();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = 240;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.09);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.1);
}

function playChime() {
  const ctx = ensureAudio();
  if (!ctx) return;
  [392, 494, 587].forEach((freq, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = ctx.currentTime + index * 0.08;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.04, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.3);
  });
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
  fanLabel = "fans",
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
  const [phase, setPhase] = useState(null);
  const [enterSide, setEnterSide] = useState(null);
  const [dragX, setDragX] = useState(0);
  const [streak, setStreak] = useState({ id: null, n: 0 });
  const [ribbon, setRibbon] = useState("");
  const [finding, setFinding] = useState(false);
  const [failed, setFailed] = useState("");
  const [capped, setCapped] = useState(false);
  const [shared, setShared] = useState("");
  const [side, setSide] = useState("");
  const [askingSide, setAskingSide] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [motionOk, setMotionOk] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const retryRef = useRef(null);
  const dragRef = useRef(null);
  const shareBlob = useRef(null);
  const lockRef = useRef(false);
  const soundRef = useRef(false);
  const ribbonTimer = useRef(null);
  const chimeRef = useRef("");
  soundRef.current = soundOn;

  function showPair(state, holdSide) {
    const held = holdSides(state.pair, state.incumbentId, holdSide);
    const [nextLeft, nextRight] = held || sidesFor(state.pair, state.incumbentId);
    setLeft(nextLeft);
    setRight(nextRight);
    setRun(state);
    if (held) setEnterSide(holdSide === "left" ? "right" : "left");
    else setEnterSide(null);
    return state;
  }

  function showRibbon(state) {
    if (state?.pick !== 6 && state?.pick !== 11) return;
    const incumbent = (state.deck || []).find((card) => card.id === state.incumbentId);
    if (!incumbent?.name) return;
    setRibbon(`Your favourite so far: ${incumbent.name}`);
    clearTimeout(ribbonTimer.current);
    ribbonTimer.current = setTimeout(() => setRibbon(""), 1000);
  }

  async function begin(nextSide) {
    const affiliation = nextSide || side || readSide(club);
    setBusy(true);
    setFailed("");
    setCapped(false);
    setShared("");
    setFinding(false);
    setPhase(null);
    setStreak({ id: null, n: 0 });
    setCelebrate(false);
    chimeRef.current = "";
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
        setLeft(null);
        setRight(null);
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
    return () => clearTimeout(ribbonTimer.current);
    // The first deck comes from the server on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [club]);

  useEffect(() => {
    try {
      setSoundOn(localStorage.getItem(SOUND_KEY) === "1");
    } catch {
      setSoundOn(false);
    }
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setMotionOk(!media.matches);
    sync();
    media.addEventListener?.("change", sync);
    return () => media.removeEventListener?.("change", sync);
  }, []);

  async function finishRun(data) {
    setLeft(null);
    setRight(null);
    setPhase(null);
    setFinding(true);
    await wait(1800);
    const finished = await post(`/api/watch-with/${club}/complete`, {
      runId: data.runId,
      championId: data.champion.id,
      preview,
    });
    setFinding(false);
    setRun(finished);
    setCelebrate(true);
  }

  async function choose(card) {
    if (!run || busy || lockRef.current || !left || !right || !card) return;
    lockRef.current = true;
    setBusy(true);
    setFailed("");
    setDragX(0);
    const winnerSide = card.id === left.id ? "left" : "right";
    setPhase(winnerSide);
    if (soundRef.current) playTap();
    try {
      navigator.vibrate?.(10);
    } catch {
      // Vibration is optional.
    }
    await wait(280);
    try {
      const data = await post(`/api/watch-with/${club}/pick`, {
        runId: run.runId,
        winnerId: card.id,
        loserId: card.id === left.id ? right.id : left.id,
        preview,
      });
      if (data.needsComplete && data.champion) {
        await finishRun(data);
      } else {
        const next = data.state || data;
        setStreak((current) => (
          current.id === next.incumbentId ? { id: next.incumbentId, n: current.n + 1 } : { id: next.incumbentId, n: 1 }
        ));
        showPair(next, winnerSide);
        showRibbon(next);
        setPhase("in");
        await wait(160);
      }
    } catch (error) {
      if (error.state) showPair(error.state);
      if (error.code === "daily-cap") setCapped(true);
      retryRef.current = () => choose(card);
      setFailed(error.message || "Something went wrong. Tap to try again.");
    }
    setPhase(null);
    setEnterSide(null);
    lockRef.current = false;
    setBusy(false);
  }

  function onPointerDown(event) {
    if (busy || lockRef.current) return;
    dragRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event) {
    const start = dragRef.current;
    if (!start || busy) return;
    setDragX(event.clientX - start.x);
  }

  function onPointerUp(event) {
    const start = dragRef.current;
    dragRef.current = null;
    setDragX(0);
    if (!start || busy || lockRef.current) return;
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

  function clubUrl() {
    return new URL(rankingHref.replace(/\/ranking$/, "") || "/", window.location.origin).href;
  }

  async function shareCardFile() {
    if (!run?.champion) return null;
    let blob = shareBlob.current;
    if (!blob) {
      const canvas = await drawShareCard({
        name: run.champion.name,
        tagline: run.champion.tagline,
        category: run.champion.category,
        primary,
        shareHost,
      });
      blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      shareBlob.current = blob;
    }
    return blob;
  }

  async function share() {
    if (!run?.champion) return;
    const pageUrl = clubUrl();
    const blob = await shareCardFile();
    const text = `My matchday companion is ${run.champion.name}. Who would you pick?`;
    const file = blob ? new File([blob], "matchday-companion.png", { type: "image/png" }) : null;
    try {
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text, url: pageUrl });
        setShared("Shared");
        return;
      }
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
    try {
      if (navigator.share) {
        await navigator.share({ text, url: pageUrl });
        setShared("Shared");
        return;
      }
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
    if (blob) {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "matchday-companion.png";
      link.click();
      URL.revokeObjectURL(link.href);
    }
    try {
      await navigator.clipboard.writeText(pageUrl);
      setShared("Link copied");
    } catch {
      setShared("Image saved");
    }
  }

  async function challenge() {
    if (!run?.champion) return;
    const pageUrl = clubUrl();
    const text = `I picked ${run.champion.name}. Who would you pick?`;
    try {
      if (navigator.share) {
        await navigator.share({ text, url: pageUrl });
        setShared("Shared");
        return;
      }
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(`${text} ${pageUrl}`);
      setShared("Link copied");
    } catch {
      setShared("");
    }
  }

  function toggleSound() {
    const next = !soundRef.current;
    soundRef.current = next;
    setSoundOn(next);
    try {
      localStorage.setItem(SOUND_KEY, next ? "1" : "0");
    } catch {
      // The toggle still works for this visit.
    }
    if (next) ensureAudio();
  }

  const showingResult = Boolean(run?.champion && run.done && !run.pair && !finding);

  useEffect(() => {
    if (!showingResult || !run?.champion) return undefined;
    let cancel = false;
    drawShareCard({
      name: run.champion.name,
      tagline: run.champion.tagline,
      category: run.champion.category,
      primary,
      shareHost,
    }).then((canvas) => {
      if (cancel) return;
      canvas.toBlob((blob) => {
        shareBlob.current = blob;
      }, "image/png");
    });
    return () => {
      cancel = true;
    };
  }, [showingResult, run?.champion, primary, shareHost]);

  useEffect(() => {
    if (!showingResult || !soundRef.current || !run?.champion?.id) return;
    if (chimeRef.current === run.champion.id) return;
    chimeRef.current = run.champion.id;
    playChime();
  }, [showingResult, run?.champion]);

  const favored = dragX < -16 ? "left" : dragX > 16 ? "right" : null;

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-4 py-5 md:max-w-3xl" style={font}>
      <style>{motionCss}</style>
      <button
        type="button"
        onClick={toggleSound}
        aria-pressed={soundOn}
        aria-label={soundOn ? "Sound on" : "Sound off"}
        className="absolute right-3 top-3 z-30 flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#0A111F] bg-[#F2EDE4] text-[#0A111F]"
      >
        <SpeakerIcon on={soundOn} />
      </button>

      <header className="flex flex-col gap-2 pr-12">
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

      {run && !showingResult && !askingSide && !finding ? (
        <div className="mt-5">
          <p className="mb-2 text-sm font-medium text-[#0A111F]" aria-live="polite">Pick {run.pick} of {run.totalPicks}</p>
          <div className="flex gap-1.5" aria-hidden="true">
            {Array.from({ length: run.totalPicks }, (_, index) => {
              const filled = index < run.pick - 1;
              const current = index === run.pick - 1;
              return (
                <span
                  key={index}
                  className={`h-2.5 flex-1 rounded-full ${current && motionOk ? "ww-pip" : ""}`}
                  style={{ background: filled || current ? accent : "rgba(10,17,31,0.15)", opacity: current && !filled ? 0.55 : 1 }}
                />
              );
            })}
          </div>
        </div>
      ) : null}

      {ribbon ? (
        <p className="mt-3 rounded-[14px] bg-[#0A111F] px-3 py-2 text-center text-sm font-semibold text-[#F2EDE4]" aria-live="polite">{ribbon}</p>
      ) : null}

      {finding ? (
        <section className="relative mt-6 flex min-h-[62dvh] flex-1 items-center justify-center overflow-hidden rounded-[14px] px-6 text-center" style={{ background: primary, color: inkOn(primary) }}>
          {motionOk ? <span className="ww-sweep pointer-events-none absolute inset-y-0 w-1/2" style={{ background: accent }} /> : null}
          <h2 className="relative text-3xl font-semibold leading-tight">Finding your matchday companion</h2>
        </section>
      ) : null}

      {showingResult && run.champion && !askingSide ? (
        <section className="relative mt-6 flex flex-1 flex-col gap-4">
          {celebrate ? <Confetti primary={primary} accent={accent} /> : null}
          <article className="rounded-[14px] p-6" style={{ background: primary, color: inkOn(primary), boxShadow: `inset 0 0 0 2px #F2EDE4` }}>
            <p className="inline-flex rounded-full bg-[#F2EDE4] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: primary }}>{categoryLabel(run.champion.category)}</p>
            <p className="mt-4 text-sm font-semibold uppercase tracking-[0.14em]">Your matchday companion</p>
            <h2 className="mt-2 text-5xl font-semibold leading-[0.95]">{run.champion.name}</h2>
            <p className="mt-4 text-lg leading-snug">{run.champion.tagline}</p>
          </article>
          {run.social?.mode === "proof" ? (
            <p className="text-sm font-medium text-[#0A111F]">{run.social.pct}% of {fanLabel} also picked {run.champion.name}</p>
          ) : null}
          {run.social?.mode === "early" ? (
            <p className="text-sm font-medium text-[#0A111F]">You are one of the first {fanLabel} to play.</p>
          ) : null}
          <button type="button" onClick={share} className={primaryClass}>Share my companion</button>
          <SaveResult club={club} runId={run.runId} accountEmail={accountEmail} preview={preview} />
          {shared ? <p className="text-sm" role="status">{shared}</p> : null}
          <Link href={rankingHref} className={ghostClass}>See the ranking</Link>
          <button type="button" onClick={begin} className={linkClass}>Play again</button>
          <button type="button" onClick={challenge} className={linkClass}>Challenge a mate</button>
          <p className="text-sm text-[#0A111F]">
            {sideLabel(side || readSide(club), shortName)}{" "}
            <button type="button" onClick={() => setAskingSide(true)} className="font-semibold underline-offset-4 hover:underline">Change</button>
          </p>
        </section>
      ) : null}

      {!showingResult && !askingSide && !finding && left && right ? (
        <div
          className="relative mt-4 flex flex-1 flex-col"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {club === "west-ham" && motionOk ? <Bubbles primary={primary} accent={accent} /> : null}
          <div className="relative grid min-h-[calc(100dvh-16rem)] flex-1 grid-cols-2 gap-3">
            <Card
              card={left}
              side="left"
              accent={accent}
              favored={favored === "left"}
              dimmed={favored === "right"}
              phase={phase}
              entering={phase === "in" && enterSide === "left"}
              incumbent={Boolean(run?.incumbentId && left.id === run.incumbentId)}
              streak={streak.id === left.id ? streak.n : 0}
            />
            <span className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#D8232A] text-sm font-semibold text-[#F2EDE4]">VS</span>
            <Card
              card={right}
              side="right"
              accent={accent}
              favored={favored === "right"}
              dimmed={favored === "left"}
              phase={phase}
              entering={phase === "in" && enterSide === "right"}
              incumbent={Boolean(run?.incumbentId && right.id === run.incumbentId)}
              streak={streak.id === right.id ? streak.n : 0}
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <button type="button" disabled={busy} onClick={() => choose(left)} className={leftButton}>
              I&apos;ll take {buttonName(left.name)}
            </button>
            <button type="button" disabled={busy} onClick={() => choose(right)} className={rightButton} style={{ background: accent, borderColor: accent, color: inkOn(accent) }}>
              I&apos;ll take {buttonName(right.name)}
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

      {busy && !left && !showingResult && !capped && !finding ? <p className="mt-8 text-sm">Shuffling the deck.</p> : null}

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

function Card({ card, side, accent, favored, dimmed, phase, entering, incumbent, streak }) {
  const winning = phase === side;
  const losing = phase === "left" || phase === "right" ? phase !== side : false;
  let animation = "";
  if (winning) animation = "ww-win";
  else if (losing) animation = side === "left" ? "ww-lose-left" : "ww-lose-right";
  else if (entering) animation = side === "left" ? "ww-in-left" : "ww-in-right";
  return (
    <article
      className={`relative z-10 flex h-full min-h-[52dvh] flex-col justify-end rounded-[14px] border-2 p-4 ${animation}`}
      style={{
        background: "#0A111F",
        borderColor: favored || winning ? accent : "#0A111F",
        color: "#F2EDE4",
        opacity: dimmed ? 0.7 : 1,
        transform: favored && !winning ? "scale(1.03)" : undefined,
        boxShadow: favored || winning ? `0 0 28px ${accent}` : undefined,
      }}
    >
      <div className="mb-auto flex flex-col items-start gap-2">
        <p className="rounded-full bg-[#F2EDE4] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0A111F]">{categoryLabel(card.category)}</p>
        {incumbent && streak >= 2 ? (
          <p className="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ background: accent, color: inkOn(accent) }}>
            On the sofa
            <span className="mt-0.5 block normal-case tracking-normal">Holding the seat: {streak} in a row</span>
          </p>
        ) : null}
      </div>
      <h2 className="mt-4 text-2xl font-semibold leading-tight md:text-4xl">{card.name}</h2>
      <p className="mt-2 text-sm leading-snug opacity-90">{card.tagline}</p>
    </article>
  );
}

function Bubbles({ primary, accent }) {
  const spots = [
    [8, 70, primary], [22, 40, accent], [38, 82, primary], [54, 30, accent],
    [68, 76, primary], [80, 48, accent], [14, 18, accent], [46, 58, primary],
    [72, 16, primary], [88, 68, accent], [30, 88, accent], [60, 92, primary],
  ];
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      {spots.map(([left, delay, color], index) => (
        <span
          key={index}
          className="ww-bubble absolute bottom-0 h-8 w-8 rounded-full opacity-25"
          style={{ left: `${left}%`, background: color, animationDelay: `${delay / 40}s` }}
        />
      ))}
    </div>
  );
}

function Confetti({ primary, accent }) {
  const ref = useRef(null);
  useEffect(() => {
    if (reducedMotion()) return undefined;
    const canvas = ref.current;
    if (!canvas) return undefined;
    const colors = [primary, accent, "#F2EDE4"];
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const pieces = Array.from({ length: 60 }, () => ({
      x: width / 2 + (Math.random() - 0.5) * 80,
      y: height * 0.28,
      vx: (Math.random() - 0.5) * 8,
      vy: -Math.random() * 7 - 2,
      size: 4 + Math.random() * 5,
      color: colors[Math.floor(Math.random() * colors.length)] || "#F2EDE4",
    }));
    const started = performance.now();
    let frame = 0;
    const draw = (now) => {
      const elapsed = now - started;
      ctx.clearRect(0, 0, width, height);
      pieces.forEach((piece) => {
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.vy += 0.12;
        ctx.globalAlpha = Math.max(0, 1 - elapsed / 2000);
        ctx.fillStyle = piece.color;
        ctx.fillRect(piece.x, piece.y, piece.size, piece.size * 0.6);
      });
      ctx.globalAlpha = 1;
      if (elapsed < 2000) frame = requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, width, height);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [primary, accent]);
  return <canvas ref={ref} width={640} height={900} className="pointer-events-none absolute inset-0 z-20 h-full w-full" aria-hidden="true" />;
}

function SpeakerIcon({ on }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M3 7h3l4-3v10L6 11H3V7z" fill="currentColor" />
      {on ? <path d="M12 6.5a3.5 3.5 0 0 1 0 5" fill="none" stroke="currentColor" strokeWidth="1.6" /> : <path d="M12 6l4 6M16 6l-4 6" fill="none" stroke="currentColor" strokeWidth="1.6" />}
    </svg>
  );
}

const motionCss = `
@keyframes ww-win { 0% { transform: scale(1); } 45% { transform: scale(1.06); } 100% { transform: scale(1.03); } }
@keyframes ww-lose-left { 0% { opacity: 1; transform: translateX(0); } 35% { transform: translateX(8px); } 100% { opacity: 0; transform: translateX(-120%); } }
@keyframes ww-lose-right { 0% { opacity: 1; transform: translateX(0); } 35% { transform: translateX(-8px); } 100% { opacity: 0; transform: translateX(120%); } }
@keyframes ww-in-left { from { opacity: 0; transform: translateX(-110%); } to { opacity: 1; transform: none; } }
@keyframes ww-in-right { from { opacity: 0; transform: translateX(110%); } to { opacity: 1; transform: none; } }
@keyframes ww-pip { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.35); } }
@keyframes ww-bubble { from { transform: translateY(0); } to { transform: translateY(-120dvh); } }
@keyframes ww-sweep { from { transform: translateX(-120%); } to { transform: translateX(280%); } }
.ww-win { animation: ww-win 280ms ease-out both; }
.ww-lose-left, .ww-lose-right { animation-duration: 280ms; animation-timing-function: ease-in; animation-fill-mode: both; }
.ww-lose-left { animation-name: ww-lose-left; }
.ww-lose-right { animation-name: ww-lose-right; }
.ww-in-left, .ww-in-right { animation-duration: 160ms; animation-timing-function: ease-out; animation-fill-mode: both; }
.ww-in-left { animation-name: ww-in-left; }
.ww-in-right { animation-name: ww-in-right; }
.ww-pip { animation: ww-pip 900ms ease-in-out infinite; transform-origin: center; }
.ww-bubble { animation: ww-bubble 14s linear infinite; }
.ww-sweep { animation: ww-sweep 1.8s linear; opacity: 0.35; }
@media (prefers-reduced-motion: reduce) {
  .ww-win, .ww-lose-left, .ww-lose-right, .ww-in-left, .ww-in-right, .ww-pip, .ww-bubble, .ww-sweep { animation: none !important; }
}
`;

const primaryClass =
  "min-h-14 rounded-[14px] bg-[#D8232A] px-4 text-lg font-semibold text-[#F2EDE4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A111F]";

const ghostClass =
  "inline-flex min-h-12 items-center justify-center rounded-[14px] border-2 border-[#0A111F] px-4 text-base font-semibold text-[#0A111F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8232A]";

const linkClass =
  "min-h-12 text-center text-sm font-semibold text-[#0A111F] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8232A]";

const leftButton =
  "min-h-14 rounded-[14px] border-2 border-[#0A111F] bg-[#0A111F] px-2 text-sm font-semibold text-[#F2EDE4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8232A] disabled:opacity-60";

const rightButton =
  "min-h-14 rounded-[14px] border-2 px-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A111F] disabled:opacity-60";

const sideButton =
  "min-h-14 w-full rounded-[14px] border-2 border-[#0A111F] px-4 text-left text-base font-semibold text-[#0A111F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8232A]";
