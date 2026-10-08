import ScoreValue from "./ScoreValue.js";
import fb from "./feedback.module.css";
import { roundLabel, streakBadge } from "@/lib/play/feedback.js";

export default function ScoreBar({ score, answered, max, streak = 0 }) {
  const badge = streakBadge(streak);
  return (
    <div className="border-b border-navy/15 bg-paper/95" role="status" aria-live="polite">
      <div className="mx-auto flex max-w-md items-end justify-between px-5 py-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-navy/60">Score</p>
          <p className="text-3xl font-black leading-none tabular-nums" data-testid="score">
            <ScoreValue score={score} />
          </p>
        </div>
        <p className={`${fb.round} text-navy/70 tabular-nums`}>
          {roundLabel(answered, max)}
          {badge && (
            <span key={badge} className={fb.streak} aria-label={`${streak} correct in a row`}>
              {badge}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
