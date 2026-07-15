"use client";

import { useMemo, useState } from "react";

function ClubEditor({ options, selected, onChange }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 20);
    return options.filter((c) => c.toLowerCase().includes(q)).slice(0, 20);
  }, [options, query]);

  function toggle(club) {
    onChange(
      selected.includes(club)
        ? selected.filter((c) => c !== club)
        : [...selected, club]
    );
  }

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search clubs"
        className="mt-2 w-full border border-navy/20 bg-paper px-3 py-2 text-sm text-navy outline-none focus:border-navy/50"
      />
      <div className="mt-2 flex max-h-32 flex-wrap gap-2 overflow-y-auto">
        {filtered.map((club) => (
          <button
            key={club}
            type="button"
            onClick={() => toggle(club)}
            className={`rounded-full border px-2.5 py-1 text-xs ${
              selected.includes(club)
                ? "border-navy bg-navy text-paper"
                : "border-navy/20 text-navy/75"
            }`}
          >
            {club}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function SettingsPanel({
  initialName,
  initialClubs,
  initialMarketing,
  email,
  clubOptions,
}) {
  const [name, setName] = useState(initialName);
  const [clubs, setClubs] = useState(initialClubs);
  const [marketing, setMarketing] = useState(initialMarketing);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  async function save(event) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/account/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferredName: name.trim(),
          clubs,
          marketingConsent: marketing,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? "Could not save settings.");
        return;
      }
      setSaved(true);
    } catch {
      setError("Could not save settings.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mt-12 border-t border-navy/10 pt-10">
      <h2 className="font-display text-xl text-navy/80">Settings</h2>
      <form className="mt-6 max-w-lg space-y-6" onSubmit={save}>
        <div>
          <label htmlFor="settings-name" className="block text-sm text-navy/70">
            Preferred name
          </label>
          <input
            id="settings-name"
            type="text"
            maxLength={40}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-2 w-full border border-navy/20 bg-paper px-3 py-2 text-navy outline-none focus:border-navy/50"
          />
        </div>

        <div>
          <span className="block text-sm text-navy/70">Clubs</span>
          <ClubEditor options={clubOptions} selected={clubs} onChange={setClubs} />
        </div>

        <div>
          <span className="block text-sm text-navy/70">Email</span>
          <p className="mt-2 text-sm text-navy/60">{email}</p>
        </div>

        <label className="flex items-start gap-3 text-sm text-navy/80">
          <input
            type="checkbox"
            checked={marketing}
            onChange={(e) => setMarketing(e.target.checked)}
            className="mt-1 h-4 w-4"
          />
          <span>First to new films, games, and results.</span>
        </label>

        <button
          type="submit"
          disabled={pending}
          className="rounded-full border border-navy/25 px-5 py-2 text-xs font-medium uppercase tracking-widest text-navy/80 hover:border-navy/50 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save settings"}
        </button>

        {saved ? (
          <p className="text-sm text-navy/60">Settings saved.</p>
        ) : null}
        {error ? <p className="text-sm text-signal">{error}</p> : null}
      </form>

      <form action="/auth/signout" method="post" className="mt-8">
        <button
          type="submit"
          className="text-sm text-navy/55 underline-offset-2 hover:text-navy/75 hover:underline"
        >
          Sign out
        </button>
      </form>
      <p className="mt-4 text-xs text-navy/45">
        To delete your account, contact melo@thereflectivefootball.com
      </p>
    </section>
  );
}
