import FansButton from "./FansButton.js";
import fans from "./fans.module.css";
import { FANS_LINE } from "@/lib/play/links.js";

function SaveBlock({ finish, onRetry, retrying }) {
  if (finish.saved) {
    return (
      <div className="rounded-lg border-2 border-navy px-4 py-3" role="status">
        <p className="text-base font-bold">Score saved</p>
        <p className="mt-1 text-sm">
          {finish.saved.counted
            ? "It counts for this week's leaderboard."
            : "Your first saved score each day counts for the leaderboard."}
        </p>
      </div>
    );
  }
  if (finish.signedIn === false) {
    return (
      <div>
        <a
          href={finish.signInHref}
          className="block rounded-lg bg-signal px-4 py-3 text-center text-base font-bold text-paper"
        >
          Sign up free to save your score
        </a>
        <p className="mt-2 text-center text-sm text-navy/70">Already a member? Sign in on the same page.</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border-2 border-navy px-4 py-3" role="alert">
      <p className="text-base font-bold">{finish.error ?? "Could not save your score."}</p>
      <button
        onClick={onRetry}
        disabled={retrying}
        className="mt-2 w-full rounded-lg bg-signal px-4 py-3 text-base font-bold text-paper disabled:opacity-40"
      >
        Try saving again
      </button>
    </div>
  );
}

export default function EndScreen({ base = "", finish, onAgain, onRetry, retrying }) {
  const s = finish.summary;
  const stats = [
    ["Questions answered", s.answered],
    ["Correct", s.correct],
    ["Incorrect", s.incorrect],
    ["Average points per question", s.averagePoints],
  ];
  return (
    <section className="mx-auto max-w-md px-5 py-8">
      <p className="text-xs font-bold uppercase tracking-widest text-navy/60">Full time</p>
      <p className="mt-2 text-7xl font-black leading-none tabular-nums" data-testid="final-score">
        {s.score}
      </p>
      <p className="mt-1 text-base font-semibold">points</p>
      <dl className="mt-6 divide-y divide-navy/15 border-y border-navy/15">
        {stats.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between py-3">
            <dt className="text-sm font-semibold text-navy/70">{k}</dt>
            <dd className="text-xl font-black tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-6 flex flex-col gap-3">
        <SaveBlock finish={finish} onRetry={onRetry} retrying={retrying} />
        <button onClick={onAgain} className="rounded-lg bg-navy px-4 py-3 text-base font-bold text-paper">
          Play again
        </button>
        {/* Plain anchor: a client link to the same route would keep the end screen mounted. */}
        <a href="/play" className="rounded-lg border-2 border-navy px-4 py-3 text-center text-base font-bold">
          See the leaderboard
        </a>
        <p className={fans.line}>{FANS_LINE}</p>
        <FansButton />
      </div>
    </section>
  );
}
