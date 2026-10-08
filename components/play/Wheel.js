"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import styles from "./play.module.css";

const SIZE = 360;
const C = SIZE / 2;
const R_OUT = 148;
const R_IN = 58;
const RIM = 164;
const STUD_R = 168;
const STUDS = 28;
const SPIN_MS = 4600;
const REDUCED_MS = 1500;
const TURNS = 4;

const LOOKUP = {
  Arsenal: { fill: "#D8232A", ink: "#F2EDE4" },
  Chelsea: { fill: "#1B4F9C", ink: "#F2EDE4" },
  Spurs: { fill: "#F2EDE4", ink: "#0A111F" },
  "West Ham": { fill: "#6E1E32", ink: "#F2EDE4" },
};

const FALLBACK = [
  { fill: "#1B4F9C", ink: "#F2EDE4" },
  { fill: "#F2EDE4", ink: "#0A111F" },
  { fill: "#6E1E32", ink: "#F2EDE4" },
  { fill: "#F5C451", ink: "#0A111F" },
  { fill: "#0E7C66", ink: "#F2EDE4" },
  { fill: "#E8D7B0", ink: "#0A111F" },
  { fill: "#3D2B8C", ink: "#F2EDE4" },
  { fill: "#C45C26", ink: "#F2EDE4" },
];

const EXHAUSTED = { fill: "#2A3142", ink: "#8E95A6" };

function polar(angleDeg, radius) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return [C + radius * Math.cos(a), C + radius * Math.sin(a)];
}

function band(a0, a1) {
  const [x0, y0] = polar(a0, R_OUT);
  const [x1, y1] = polar(a1, R_OUT);
  const [x2, y2] = polar(a1, R_IN);
  const [x3, y3] = polar(a0, R_IN);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${R_OUT} ${R_OUT} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${R_IN} ${R_IN} 0 ${large} 0 ${x3} ${y3} Z`;
}

function initials(name) {
  const known = { Arsenal: "ARS", Chelsea: "CHE", Spurs: "SPU", "West Ham": "WHU" };
  if (known[name]) return known[name];
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return parts.slice(0, 3).map((p) => p[0]).join("").toUpperCase();
  return name.slice(0, 3).toUpperCase();
}

function look(name, i, exhausted) {
  if (exhausted) return EXHAUSTED;
  return LOOKUP[name] ?? FALLBACK[i % FALLBACK.length];
}

const QUERY = "(prefers-reduced-motion: reduce)";
function subscribeMotion(cb) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const reducedNow = () => window.matchMedia(QUERY).matches;

/** `target` is the category the server picked, set after the spin request returns. */
export default function Wheel({ segments, target, spinId = null, onDone }) {
  const [rotation, setRotation] = useState(0);
  const [live, setLive] = useState(false);
  const [winner, setWinner] = useState(null);
  const [pulse, setPulse] = useState(false);
  const reduced = useSyncExternalStore(subscribeMotion, reducedNow, () => false);
  const doneRef = useRef(onDone);
  const rotRef = useRef(0);
  const discRef = useRef(null);
  useEffect(() => {
    doneRef.current = onDone;
  });

  const n = segments.length;
  const step = n ? 360 / n : 360;
  const ready = !target && !live;

  useEffect(() => {
    if (!target) {
      setWinner(null);
      setPulse(false);
      return;
    }
    const idx = segments.findIndex((s) => s.name === target);
    if (idx < 0) {
      doneRef.current();
      return;
    }
    const centre = idx * step + step / 2;
    const from = rotRef.current;
    const to = Math.ceil(from / 360) * 360 + 360 * TURNS + (360 - centre);
    const disc = discRef.current;
    const shorten = reducedNow();
    const duration = shorten ? REDUCED_MS : SPIN_MS;
    if (!disc) {
      rotRef.current = to;
      setRotation(to);
      setWinner(idx);
      setPulse(false);
      doneRef.current();
      return;
    }

    setLive(true);
    setWinner(null);
    setPulse(false);
    const delta = to - from;
    let settled = false;
    const anim = disc.animate(
      [
        { transform: `rotate(${from}deg)`, easing: "cubic-bezier(0.55, 0.02, 0.75, 0.35)" },
        { transform: `rotate(${from + delta * 0.1}deg)`, offset: 0.3, easing: "linear" },
        { transform: `rotate(${from + delta * 0.72}deg)`, offset: 0.55, easing: "cubic-bezier(0.08, 0.45, 0.05, 1)" },
        { transform: `rotate(${to}deg)`, offset: 1 },
      ],
      { duration, fill: "forwards" },
    );
    const finish = () => {
      if (settled) return;
      settled = true;
      try {
        anim.commitStyles();
      } catch {
        /* commitStyles is missing in older browsers; the state update matches the end angle. */
      }
      anim.cancel();
      rotRef.current = to;
      setRotation(to);
      setLive(false);
      setWinner(idx);
      setPulse(!shorten);
      doneRef.current();
    };
    anim.onfinish = finish;
    return () => {
      settled = true;
      anim.cancel();
    };
    // Landing uses the server category. spinId retriggers when that category comes up again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, spinId]);

  return (
    <div className={styles.wheel} aria-label="Category wheel">
      <p className={`${styles.ready} ${ready ? styles.readyOn : ""}`} aria-hidden={!ready}>
        READY?
      </p>
      <div className={styles.face}>
        <div className={`${styles.drift} ${ready && !reduced ? styles.driftOn : ""}`}>
          <svg
            ref={discRef}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className={styles.disc}
            style={live ? undefined : { transform: `rotate(${rotation}deg)` }}
          >
            {segments.map((s, i) => {
              const a0 = i * step;
              const a1 = (i + 1) * step;
              const paint = look(s.name, i, s.exhausted && i !== winner);
              const mid = a0 + step / 2;
              const [tx, ty] = polar(mid, (R_OUT + R_IN) / 2);
              const mark = initials(s.name);
              const lit = i === winner;
              return (
                <g
                  key={s.name}
                  className={lit ? (pulse ? styles.winner : styles.winnerStill) : undefined}
                >
                  <path d={band(a0, a1)} fill={paint.fill} stroke="#0A111F" strokeWidth={3} />
                  <text
                    x={tx}
                    y={ty}
                    transform={`rotate(${mid} ${tx} ${ty})`}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={paint.ink}
                    fontFamily="var(--font-archivo), Archivo, sans-serif"
                    fontSize={n > 6 ? 18 : 26}
                    fontWeight={800}
                    letterSpacing="-0.04em"
                  >
                    {mark}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className={`${styles.rim} ${live ? styles.studsOn : ""}`} aria-hidden>
          <circle cx={C} cy={C} r={RIM} fill="none" stroke="#F5C451" strokeWidth={14} />
          <circle cx={C} cy={C} r={R_IN - 8} fill="#0A111F" stroke="#F5C451" strokeWidth={4} />
          {Array.from({ length: STUDS }, (_, i) => {
            const [x, y] = polar((360 / STUDS) * i, STUD_R);
            return (
              <circle
                key={i}
                className={styles.stud}
                cx={x}
                cy={y}
                r={4.2}
                style={{ animationDelay: `${(i * 0.8) / STUDS}s` }}
              />
            );
          })}
        </svg>
        <div className={styles.pointer} />
      </div>
    </div>
  );
}
