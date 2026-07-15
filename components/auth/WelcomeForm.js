"use client";

import { useMemo, useState } from "react";
import { formatMemberNumber } from "@/lib/auth/config";

function ClubPicker({ options, selected, onToggle }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 16);
    return options.filter((club) => club.toLowerCase().includes(q)).slice(0, 16);
  }, [options, query]);

  return (
    <div>
      <label htmlFor="club-search" className="block text-sm text-navy/80">
        Who do you support?
      </label>
      <p className="mt-1 text-xs text-navy/50">Pick any clubs you follow. Optional.</p>
      <input
        id="club-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search clubs"
        className="mt-3 w-full border border-navy/20 bg-paper px-4 py-2.5 text-sm text-navy outline-none placeholder:text-navy/40 focus:border-navy/50"
      />
      <div className="mt-3 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
        {filtered.map((club) => {
          const active = selected.includes(club);
          return (
            <button
              key={club}
              type="button"
              onClick={() => onToggle(club)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                active
                  ? "border-navy bg-navy text-paper"
                  : "border-navy/20 text-navy/75 hover:border-navy/40"
              }`}
            >
              {club}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function WelcomeForm({
  email,
  clubOptions,
  nextPath = "/",
}) {
  const [preferredName, setPreferredName] = useState("");
  const [clubs, setClubs] = useState([]);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [complete, setComplete] = useState(null);

  function toggleClub(club) {
    setClubs((current) =>
      current.includes(club)
        ? current.filter((c) => c !== club)
        : [...current, club]
    );
  }

  async function submit({ skipName = false, skipClubs = false } = {}) {
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/auth/welcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferredName: skipName ? null : preferredName.trim(),
          clubs: skipClubs ? [] : clubs,
          marketingConsent,
          skipName,
          skipClubs,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? "Something went wrong. Try again.");
        return;
      }
      setComplete(data);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  }

  if (complete) {
    return (
      <div className="w-full max-w-lg border border-navy/10 bg-paper p-8 text-center shadow-[0_12px_40px_rgba(10,17,31,0.08)]">
        <h1 className="font-display text-3xl leading-tight text-navy sm:text-4xl">
          Welcome to The Reflective Football, {complete.preferredName}.
        </h1>
        <p className="mt-4 text-lg text-navy/80">
          You&apos;re Member {formatMemberNumber(complete.memberNumber)}.
        </p>
        <a
          href={nextPath}
          className="mt-8 inline-block rounded-full bg-signal px-8 py-3 text-sm font-medium uppercase tracking-widest text-paper transition-opacity hover:opacity-90"
        >
          Continue
        </a>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg border border-navy/10 bg-paper p-8 shadow-[0_12px_40px_rgba(10,17,31,0.08)]">
      <h1 className="font-display text-3xl leading-tight text-navy sm:text-4xl">
        Welcome aboard
      </h1>
      <p className="mt-3 text-sm text-navy/70">
        Two quick questions, then you are in.
      </p>

      <div className="mt-8 space-y-8">
        <div>
          <label htmlFor="preferred-name" className="block text-sm text-navy/80">
            What should we call you?
          </label>
          <input
            id="preferred-name"
            type="text"
            maxLength={40}
            value={preferredName}
            onChange={(e) => setPreferredName(e.target.value)}
            placeholder={email ? email.split("@")[0] : "Your name"}
            className="mt-3 w-full border border-navy/20 bg-paper px-4 py-3 text-navy outline-none placeholder:text-navy/40 focus:border-navy/50"
          />
          <button
            type="button"
            onClick={() => submit({ skipName: true, skipClubs: false })}
            disabled={pending}
            className="mt-2 text-xs text-navy/50 underline-offset-2 hover:text-navy/70 hover:underline"
          >
            Skip for now
          </button>
        </div>

        <ClubPicker options={clubOptions} selected={clubs} onToggle={toggleClub} />

        <label className="flex items-start gap-3 text-sm text-navy/80">
          <input
            type="checkbox"
            checked={marketingConsent}
            onChange={(e) => setMarketingConsent(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-navy/30"
          />
          <span>First to new films, games, and results.</span>
        </label>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => submit({ skipName: false, skipClubs: false })}
          disabled={pending || !preferredName.trim()}
          className="flex-1 rounded-full bg-signal px-6 py-3 text-sm font-medium uppercase tracking-widest text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Continue"}
        </button>
        <button
          type="button"
          onClick={() => submit({ skipName: true, skipClubs: true })}
          disabled={pending}
          className="flex-1 rounded-full border border-navy/25 px-6 py-3 text-sm text-navy/80 transition-colors hover:border-navy/50"
        >
          Skip all
        </button>
      </div>

      {error ? <p className="mt-4 text-sm text-signal">{error}</p> : null}
    </div>
  );
}
