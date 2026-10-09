"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const font = { fontFamily: "var(--font-body), Archivo, sans-serif" };
const TABS = [
  { id: "all", label: "All" },
  { id: "player", label: "Players" },
  { id: "manager", label: "Managers" },
  { id: "celebrity", label: "Celebrities" },
];

export default function RankingBoard({ club, clubName, headline, rows, fans, gameHref = `/watch-with/${club}` }) {
  const [tab, setTab] = useState("all");
  const [shared, setShared] = useState(false);
  const visible = useMemo(
    () => rows
      .map((row, index) => ({ ...row, rank: index + 1 }))
      .filter((row) => tab === "all" || row.category === tab),
    [rows, tab],
  );

  async function share() {
    const url = window.location.href;
    const text = `The ${clubName} matchday companion ranking.`;
    try {
      if (navigator.share) {
        await navigator.share({ text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShared(true);
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        setShared(true);
      } catch {
        setShared(false);
      }
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:py-10" style={font}>
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D8232A]">{clubName}</p>
        <h1 className="text-3xl font-semibold leading-tight text-[#0A111F] sm:text-4xl">{headline}</h1>
        <p className="text-[#0A111F]">{fans} {fans === 1 ? "fan has" : "fans have"} played.</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={tab === item.id ? tabOn : tabOff}
          >
            {item.label}
          </button>
        ))}
      </div>

      <ol className="flex flex-col gap-3">
        {visible.map((row) => {
          const counting = row.votes < 30;
          const rate = row.votes ? Math.round((row.wins / row.votes) * 100) : 0;
          return (
            <li key={row.id} className="rounded-[14px] border-2 border-[#0A111F] bg-[#0A111F] p-4 text-[#F2EDE4]">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm text-[#D8232A]">#{row.rank}</p>
                <p className="text-xs uppercase tracking-[0.14em]">{categoryLabel(row.category)}</p>
              </div>
              <h2 className="mt-1 text-2xl font-semibold">{row.name}</h2>
              <p className="mt-1 text-sm leading-snug text-[#F2EDE4]/90">{row.tagline}</p>
              <p className="mt-3 text-sm">{counting ? "still counting" : `${rate}% win rate`}</p>
            </li>
          );
        })}
      </ol>

      {visible.length === 0 ? <p>No companions in this group yet.</p> : null}

      <button type="button" onClick={share} className={tabOn}>{shared ? "Link copied" : "Share the ranking"}</button>
      <Link href={gameHref} className="text-sm font-semibold underline-offset-4 hover:underline">Play the game</Link>
      <footer className="pb-4 text-center text-sm">
        <p>Football is nothing without the fans.</p>
        <Link href="/" className="mt-2 inline-block underline-offset-4 hover:underline">The Reflective Football</Link>
      </footer>
    </div>
  );
}

function categoryLabel(category) {
  if (category === "player") return "Player";
  if (category === "manager") return "Manager";
  if (category === "celebrity") return "Celebrity";
  return category;
}

const tabOff =
  "min-h-11 rounded-full border-2 border-[#0A111F] px-4 text-sm font-semibold text-[#0A111F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8232A]";

const tabOn =
  "min-h-11 rounded-full border-2 border-[#D8232A] bg-[#D8232A] px-4 text-sm font-semibold text-[#F2EDE4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A111F]";
