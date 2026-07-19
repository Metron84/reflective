"use client";

import { useState } from "react";

const empty = { name: "", club: "", country: "" };

export default function FanGroupForm({
  initial = null,
  onSaved,
  onCancel,
  submitLabel = "Save fan group",
}) {
  const [form, setForm] = useState(
    initial
      ? {
          name: initial.name ?? "",
          club: initial.club ?? "",
          country: initial.country ?? "",
        }
      : empty
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/tagging/fan-groups", {
        method: initial?.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: initial?.id, ...form }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? "Could not save.");
        return;
      }
      onSaved?.(data.fanGroup);
      if (!initial?.id) setForm(empty);
    } catch {
      setError("Could not save.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 border border-navy/15 bg-white/40 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-xs text-navy/60">
          Name
          <input
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Arsenal Dubai"
            className="mt-1 w-full border border-navy/20 bg-paper px-2 py-1.5 text-sm text-navy"
          />
        </label>
        <label className="block text-xs text-navy/60">
          Club
          <input
            value={form.club}
            onChange={(e) => setForm((f) => ({ ...f, club: e.target.value }))}
            className="mt-1 w-full border border-navy/20 bg-paper px-2 py-1.5 text-sm text-navy"
          />
        </label>
        <label className="block text-xs text-navy/60">
          Country
          <input
            value={form.country}
            onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
            className="mt-1 w-full border border-navy/20 bg-paper px-2 py-1.5 text-sm text-navy"
          />
        </label>
      </div>
      {error ? <p className="text-sm text-signal">{error}</p> : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-navy px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-paper disabled:opacity-50"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-navy/25 px-4 py-1.5 text-xs uppercase tracking-widest text-navy/70"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
