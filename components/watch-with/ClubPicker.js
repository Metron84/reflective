import Link from "next/link";
import { SITE_URL } from "@/lib/config";

const font = { fontFamily: "var(--font-body), Archivo, sans-serif" };

export default function ClubPicker({ clubs, pathsFor }) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:py-12" style={font}>
      <style>{pickerCss}</style>
      <header className="flex max-w-xl flex-col gap-3">
        <h1 className="text-4xl font-semibold leading-tight text-[#0A111F] sm:text-5xl">
          Who would you rather watch the match with?
        </h1>
        <p className="text-lg leading-snug text-[#0A111F]">
          Dream matchday. Any era. You choose who sits next to you.
        </p>
      </header>

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {clubs.map((club) => {
          const paths = pathsFor(club.slug);
          const runs = Number(club.completedRuns) || 0;
          return (
            <li key={club.slug}>
              {club.active ? (
                <article
                  className="ww-card relative flex h-full min-h-52 flex-col justify-between rounded-[14px] p-4 text-[#F2EDE4] motion-reduce:transform-none"
                  style={{ background: club.primaryColor }}
                >
                  <Link href={paths.game} className="absolute inset-0 rounded-[14px]" aria-label={`Play ${club.name}`} />
                  <div className="pointer-events-none relative z-10">
                    <h2 className="text-2xl font-semibold leading-tight">{club.name}</h2>
                    <p className="mt-1 text-sm text-[#F2EDE4]/80">{club.fanLabel}</p>
                  </div>
                  <div className="relative z-10 mt-6 flex flex-col gap-2">
                    <p className="pointer-events-none text-xs">
                      {runs === 0 ? "Be the first to play" : `${runs} completed ${runs === 1 ? "run" : "runs"}`}
                    </p>
                    <span className="ww-play pointer-events-none inline-flex min-h-14 items-center justify-center rounded-[14px] bg-[#F2EDE4] px-3 text-lg font-semibold text-[#0A111F]">
                      Play
                    </span>
                    <Link href={paths.ranking} className="relative z-20 text-center text-sm font-semibold underline-offset-4 hover:underline">
                      Ranking
                    </Link>
                  </div>
                </article>
              ) : (
                <article
                  className="flex h-full min-h-52 flex-col justify-between rounded-[14px] p-4 text-[#F2EDE4] opacity-45"
                  style={{ background: club.primaryColor }}
                >
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em]">Coming soon</p>
                    <h2 className="mt-2 text-2xl font-semibold leading-tight">{club.name}</h2>
                    <p className="mt-1 text-sm">{club.fanLabel}</p>
                  </div>
                </article>
              )}
            </li>
          );
        })}
      </ul>

      <footer className="text-center text-sm text-[#0A111F]">
        <p>Football is nothing without the fans.</p>
        <Link href={SITE_URL} className="mt-2 inline-block underline-offset-4 hover:underline">The Reflective Football</Link>
      </footer>
    </div>
  );
}

const pickerCss = `
.ww-card { transition: transform 180ms ease; }
.ww-card:hover { transform: translateY(-4px); }
.ww-card:active { transform: translateY(2px); }
.ww-play { animation: ww-play 1.8s ease-in-out infinite; }
@keyframes ww-play { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.04); } }
@media (prefers-reduced-motion: reduce) {
  .ww-card, .ww-card:hover, .ww-card:active { transform: none; transition: none; }
  .ww-play { animation: none; }
}
`;
