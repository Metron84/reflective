"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const SIZE = 320;
const R = 150;
const C = SIZE / 2;
const SPIN_MS = 2500;
const FILLS = ["#0A111F", "#F2EDE4"];

function polar(angleDeg, radius) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return [C + radius * Math.cos(a), C + radius * Math.sin(a)];
}

function lines(name) {
  if (name.length <= 10 || !name.includes(" ")) return [name];
  const words = name.split(" ");
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
}

const QUERY = "(prefers-reduced-motion: reduce)";
function subscribeMotion(cb) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const reducedNow = () => window.matchMedia(QUERY).matches;

/** `target` is the category the server picked, set after the spin request returns. */
export default function Wheel({ segments, target, onDone }) {
  const [rotation, setRotation] = useState(0);
  const [fade, setFade] = useState(false);
  const reduced = useSyncExternalStore(subscribeMotion, reducedNow, () => false);
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  });
  const n = segments.length;
  const step = 360 / n;

  useEffect(() => {
    if (!target) return;
    const idx = segments.findIndex((s) => s.name === target);
    if (idx < 0) {
      doneRef.current();
      return;
    }
    const centre = idx * step + step / 2;
    if (reduced) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRotation(360 - centre);
      setFade(true);
      const t = setTimeout(() => {
        setFade(false);
        doneRef.current();
      }, 400);
      return () => clearTimeout(t);
    }
    // Always move forward by whole turns, then settle with the target centre under the pointer.
    setRotation((prev) => Math.ceil(prev / 360) * 360 + 360 * 4 + (360 - centre));
    const t = setTimeout(() => doneRef.current(), SPIN_MS + 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return (
    <div className="relative mx-auto w-full max-w-[340px]" aria-label="Category wheel">
      <div
        className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1"
        aria-hidden
        style={{
          width: 0,
          height: 0,
          borderLeft: "12px solid transparent",
          borderRight: "12px solid transparent",
          borderTop: "22px solid #D8232A",
        }}
      />
      <div className="overflow-hidden">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="h-auto w-full"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: reduced ? "opacity 0.3s" : `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.7, 0.1, 1)`,
            opacity: fade ? 0.4 : 1,
          }}
        >
          <circle cx={C} cy={C} r={R + 6} fill="#0A111F" />
          {segments.map((s, i) => {
            const a0 = i * step;
            const a1 = (i + 1) * step;
            const [x0, y0] = polar(a0, R);
            const [x1, y1] = polar(a1, R);
            const large = step > 180 ? 1 : 0;
            const d =
              n === 1
                ? `M ${C} ${C - R} A ${R} ${R} 0 1 1 ${C - 0.01} ${C - R} Z`
                : `M ${C} ${C} L ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} Z`;
            const dark = i % 2 === 0;
            const fill = s.exhausted ? "#B9B3A8" : FILLS[i % 2];
            const text = s.exhausted ? "#6E6A62" : dark ? "#F2EDE4" : "#0A111F";
            const mid = a0 + step / 2;
            const [tx, ty] = polar(mid, R * 0.62);
            const ls = lines(s.name);
            return (
              <g key={s.name} opacity={s.exhausted ? 0.8 : 1}>
                <path d={d} fill={fill} stroke="#D8232A" strokeWidth={1.5} />
                <text
                  x={tx}
                  y={ty}
                  transform={`rotate(${mid} ${tx} ${ty})`}
                  textAnchor="middle"
                  fill={text}
                  fontSize={n > 6 ? 12 : 14}
                  fontWeight={700}
                >
                  {ls.map((l, k) => (
                    <tspan key={k} x={tx} dy={k === 0 ? (ls.length > 1 ? -6 : 4) : 15}>
                      {l}
                    </tspan>
                  ))}
                </text>
              </g>
            );
          })}
          <circle cx={C} cy={C} r={16} fill="#F2EDE4" stroke="#D8232A" strokeWidth={3} />
        </svg>
      </div>
    </div>
  );
}
