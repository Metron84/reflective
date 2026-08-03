'use client';

import { FREE_PLAYS, totalScore, type Progress } from '@/lib/codemaster/progress';
import { rankFor, type Rank } from '@/lib/codemaster/engine';
import { solvedCount } from '@/lib/codemaster/progress';

const NAVY = '#0A111F';
const CREAM = '#F2EDE4';
const RED = '#D8232A';

interface Props {
  progress: Progress;
  ranks: Rank[];
  totalPuzzles: number;
  signInHref: string;
  createAccountHref: string;
  onBack: () => void;
}

export default function SignupWall({
  progress,
  ranks,
  totalPuzzles,
  signInHref,
  createAccountHref,
  onBack,
}: Props) {
  const done = solvedCount(progress);
  const rank = rankFor(done, ranks);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-10">
      <button
        type="button"
        onClick={onBack}
        className="font-[Archivo,system-ui,sans-serif] text-[13px] uppercase tracking-[0.12em]"
        style={{ color: 'rgba(10,17,31,0.6)' }}
      >
        ← Back
      </button>

      <p
        className="mt-8 font-[Archivo,system-ui,sans-serif] text-[12px] font-bold uppercase tracking-[0.24em]"
        style={{ color: RED }}
      >
        {FREE_PLAYS} codes decoded
      </p>
      <h2
        className="mt-2 font-[Bodoni_Moda,Georgia,serif] text-[clamp(36px,9vw,60px)] leading-[0.95]"
        style={{ color: NAVY }}
      >
        Keep what you have cracked
      </h2>
      <p
        className="mt-4 max-w-prose font-[Archivo,system-ui,sans-serif] text-[16px] leading-relaxed"
        style={{ color: 'rgba(10,17,31,0.75)' }}
      >
        There are {totalPuzzles} codes in the journey and you have {done}. An account
        saves your rank, carries your progress between your phone and your laptop, and
        keeps it when you clear this browser.
      </p>

      <div className="mt-8 rounded-[3px] px-5 py-4" style={{ background: NAVY, color: CREAM }}>
        <p className="font-[Archivo,system-ui,sans-serif] text-[12px] uppercase tracking-[0.18em] opacity-70">
          Waiting to be saved
        </p>
        <p className="mt-2 font-[Bodoni_Moda,Georgia,serif] text-[30px] leading-none">
          {rank.title}
        </p>
        <p className="mt-2 font-[Archivo,system-ui,sans-serif] text-[14px] tabular-nums opacity-80">
          {done} of {totalPuzzles} codes · {totalScore(progress)} points
        </p>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <a
          href={createAccountHref}
          className="rounded-full px-6 py-3 font-[Archivo,system-ui,sans-serif] text-[14px] font-semibold uppercase tracking-[0.1em]"
          style={{ background: RED, color: CREAM }}
        >
          Sign up free
        </a>
        <a
          href={signInHref}
          className="rounded-full border px-6 py-3 font-[Archivo,system-ui,sans-serif] text-[14px] font-semibold uppercase tracking-[0.1em]"
          style={{ borderColor: NAVY, color: NAVY }}
        >
          Sign in
        </a>
      </div>

      <p
        className="mt-5 font-[Archivo,system-ui,sans-serif] text-[13px]"
        style={{ color: 'rgba(10,17,31,0.55)' }}
      >
        Your first {FREE_PLAYS} codes come with you when you sign in.
      </p>
    </div>
  );
}
