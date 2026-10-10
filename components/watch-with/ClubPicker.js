import Link from "next/link";
import { SITE_URL } from "@/lib/config";

const font = { fontFamily: "var(--font-body), Archivo, sans-serif" };

export default function ClubPicker({ clubs, pathsFor }) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:py-12" style={font}>
      <header className="flex max-w-xl flex-col gap-3">
        <h1 className="text-4xl font-semibold leading-tight text-[#0A111F] sm:text-5xl">
          Who would you rather watch the match with?
        </h1>
        <p className="text-lg leading-snug text-[#0A111F]">
          Dream matchday. Any era, living or legend. Pick your club.
        </p>
      </header>

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {clubs.map((club) => {
          const paths = pathsFor(club.slug);
          return (
            <li key={club.slug}>
              {club.active ? (
                <article
                  className="flex h-full min-h-44 flex-col justify-between rounded-[14px] p-4 text-[#F2EDE4]"
                  style={{ background: club.primaryColor }}
                >
                  <div>
                    <h2 className="text-2xl font-semibold leading-tight">{club.name}</h2>
                    <p className="mt-1 text-sm text-[#F2EDE4]/80">{club.fanLabel}</p>
                  </div>
                  <div className="mt-6 flex flex-col gap-2">
                    <p className="text-xs">{club.completedRuns} completed {club.completedRuns === 1 ? "run" : "runs"}</p>
                    <Link href={paths.game} className="inline-flex min-h-11 items-center justify-center rounded-[14px] bg-[#F2EDE4] px-3 text-sm font-semibold text-[#0A111F]">
                      Play
                    </Link>
                    <Link href={paths.ranking} className="text-center text-sm font-semibold underline-offset-4 hover:underline">
                      Ranking
                    </Link>
                  </div>
                </article>
              ) : (
                <article
                  className="flex h-full min-h-44 flex-col justify-between rounded-[14px] p-4 text-[#F2EDE4] opacity-45"
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
